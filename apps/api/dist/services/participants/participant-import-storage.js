import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
/** S3 uploads use the AWS SDK's configured SigV4 signer and its default credential chain. */
export class S3ParticipantImportStorage {
    client;
    bucket;
    endpoint;
    constructor(client, bucket, endpoint) {
        this.client = client;
        this.bucket = bucket;
        this.endpoint = endpoint;
    }
    async createUploadUrl(input) {
        const region = await this.client.config.region();
        const endpoint = new URL(this.endpoint ?? `https://s3.${region}.amazonaws.com`);
        const encodedKey = input.key.split('/').map(encodeURIComponent).join('/');
        const path = `${endpoint.pathname.replace(/\/$/, '')}/${encodeURIComponent(this.bucket)}/${encodedKey}`;
        const headers = {
            host: endpoint.host,
            'content-type': input.contentType,
            'x-amz-checksum-sha256': input.checksumSha256,
            'x-amz-meta-upload-id': input.uploadId,
            ...(!this.endpoint ? { 'x-amz-server-side-encryption': 'AES256' } : {}),
        };
        const requestInput = { protocol: endpoint.protocol, hostname: endpoint.hostname, ...(endpoint.port ? { port: Number(endpoint.port) } : {}), method: 'PUT', path, headers, query: {} };
        const signer = await this.client.config.signer();
        const signedHeaders = new Set(['x-amz-checksum-sha256', 'x-amz-meta-upload-id', ...(!this.endpoint ? ['x-amz-server-side-encryption'] : [])]);
        const signed = await signer.presign(requestInput, { expiresIn: 600, signableHeaders: signedHeaders, unhoistableHeaders: signedHeaders });
        const url = new URL(`${signed.protocol}//${signed.hostname}${signed.path}`);
        for (const [name, value] of Object.entries(signed.query ?? {})) {
            for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
                url.searchParams.append(name, item);
        }
        const now = Date.now();
        const uploadHeaders = Object.fromEntries(Object.entries(headers).filter(([name]) => name !== 'host'));
        return { url: url.toString(), headers: uploadHeaders, expiresAt: new Date(now + 600_000) };
    }
    async head(key) {
        const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' }));
        const metaSha = result.Metadata?.['checksum-sha256'] ?? result.Metadata?.['x-amz-checksum-sha256'];
        const metaUploadId = result.Metadata?.['upload-id'] ?? result.Metadata?.['x-amz-meta-upload-id'];
        return {
            fileSizeBytes: result.ContentLength ?? 0,
            contentType: result.ContentType ?? '',
            checksumSha256: result.ChecksumSHA256 ?? metaSha ?? '',
            uploadId: metaUploadId,
        };
    }
    async getStream(key) {
        const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        if (!result.Body)
            throw new Error('The uploaded CSV object has no content');
        return result.Body;
    }
    async put(key, body, contentType) {
        await this.putBytes(key, Buffer.from(body, 'utf-8'), contentType);
    }
    async putBytes(key, bytes, contentType, metadata) {
        const sha = metadata?.['checksum-sha256'];
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
            ...(metadata ? { Metadata: metadata } : {}),
            ...(sha ? { ChecksumAlgorithm: 'SHA256', ChecksumSHA256: sha } : {}),
            ...(!this.endpoint ? { ServerSideEncryption: 'AES256' } : {}),
        }));
    }
    async delete(key) {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
}
/** Local disk storage for environments where S3 is not configured or as fallback. */
export class LocalParticipantImportStorage {
    baseDir;
    meta = new Map();
    constructor(baseDir) {
        this.baseDir = baseDir ?? join(tmpdir(), 'hmi_participant_imports');
    }
    filePath(key) {
        const safeKey = key.replace(/[^a-zA-Z0-9_\-./]/g, '_');
        return join(this.baseDir, safeKey);
    }
    async createUploadUrl(input) {
        return {
            url: `/api/events/upload/${input.uploadId}`,
            headers: { 'content-type': input.contentType },
            expiresAt: new Date(Date.now() + 600_000),
        };
    }
    async head(key) {
        const cached = this.meta.get(key);
        if (cached)
            return cached;
        const p = this.filePath(key);
        const stat = await fs.stat(p);
        return { fileSizeBytes: stat.size, contentType: 'text/csv', checksumSha256: '' };
    }
    async getStream(key) {
        const p = this.filePath(key);
        return createReadStream(p);
    }
    async put(key, body, contentType) {
        await this.putBytes(key, Buffer.from(body, 'utf-8'), contentType);
    }
    async putBytes(key, bytes, contentType, metadata) {
        const p = this.filePath(key);
        await fs.mkdir(join(p, '..'), { recursive: true });
        await fs.writeFile(p, bytes);
        this.meta.set(key, {
            fileSizeBytes: bytes.byteLength,
            contentType,
            checksumSha256: metadata?.['checksum-sha256'] ?? '',
            uploadId: metadata?.['upload-id'],
        });
    }
    async delete(key) {
        this.meta.delete(key);
        const p = this.filePath(key);
        await fs.unlink(p).catch(() => { });
    }
}
