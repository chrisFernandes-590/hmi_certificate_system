import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { promises as fs } from 'node:fs'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export type ImportObjectMetadata = { fileSizeBytes: number; contentType: string; checksumSha256: string; uploadId?: string }

export interface ParticipantImportStorage {
  createUploadUrl(input: { key: string; uploadId: string; contentType: string; checksumSha256: string }): Promise<{ url: string; headers: Record<string, string>; expiresAt: Date }>
  head(key: string): Promise<ImportObjectMetadata>
  getStream(key: string): Promise<AsyncIterable<Uint8Array>>
  put(key: string, body: string, contentType: string): Promise<void>
  putBytes(key: string, bytes: Uint8Array, contentType: string, metadata?: Record<string, string>): Promise<void>
  delete(key: string): Promise<void>
}

/** S3 uploads use the AWS SDK's configured SigV4 signer and its default credential chain. */
export class S3ParticipantImportStorage implements ParticipantImportStorage {
  constructor(private readonly client: S3Client, private readonly bucket: string, private readonly endpoint?: string) {}

  async createUploadUrl(input: { key: string; uploadId: string; contentType: string; checksumSha256: string }) {
    const region = await this.client.config.region()
    const endpoint = new URL(this.endpoint ?? `https://s3.${region}.amazonaws.com`)
    const encodedKey = input.key.split('/').map(encodeURIComponent).join('/')
    const path = `${endpoint.pathname.replace(/\/$/, '')}/${encodeURIComponent(this.bucket)}/${encodedKey}`
    const headers = {
      host: endpoint.host,
      'content-type': input.contentType,
      'x-amz-checksum-sha256': input.checksumSha256,
      'x-amz-meta-upload-id': input.uploadId,
      ...(!this.endpoint ? { 'x-amz-server-side-encryption': 'AES256' } : {}),
    }
    const requestInput = { protocol: endpoint.protocol, hostname: endpoint.hostname, ...(endpoint.port ? { port: Number(endpoint.port) } : {}), method: 'PUT', path, headers, query: {} }
    type PresignRequest = typeof requestInput
    const signer = await this.client.config.signer() as unknown as { presign(request: PresignRequest, options: { expiresIn: number; signableHeaders: Set<string>; unhoistableHeaders: Set<string> }): Promise<PresignRequest> }
    const signedHeaders = new Set(['x-amz-checksum-sha256', 'x-amz-meta-upload-id', ...(!this.endpoint ? ['x-amz-server-side-encryption'] : [])])
    const signed = await signer.presign(requestInput, { expiresIn: 600, signableHeaders: signedHeaders, unhoistableHeaders: signedHeaders })
    const url = new URL(`${signed.protocol}//${signed.hostname}${signed.path}`)
    for (const [name, value] of Object.entries(signed.query ?? {})) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) url.searchParams.append(name, item)
    }
    const now = Date.now()
    const uploadHeaders = Object.fromEntries(Object.entries(headers).filter(([name]) => name !== 'host'))
    return { url: url.toString(), headers: uploadHeaders, expiresAt: new Date(now + 600_000) }
  }

  async head(key: string): Promise<ImportObjectMetadata> {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' }))
    const metaSha = result.Metadata?.['checksum-sha256'] ?? result.Metadata?.['x-amz-checksum-sha256']
    const metaUploadId = result.Metadata?.['upload-id'] ?? result.Metadata?.['x-amz-meta-upload-id']
    return {
      fileSizeBytes: result.ContentLength ?? 0,
      contentType: result.ContentType ?? '',
      checksumSha256: result.ChecksumSHA256 ?? metaSha ?? '',
      uploadId: metaUploadId,
    }
  }

  async getStream(key: string): Promise<AsyncIterable<Uint8Array>> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!result.Body) throw new Error('The uploaded CSV object has no content')
    return result.Body as AsyncIterable<Uint8Array>
  }

  async put(key: string, body: string, contentType: string) {
    await this.putBytes(key, Buffer.from(body, 'utf-8'), contentType)
  }

  async putBytes(key: string, bytes: Uint8Array, contentType: string, metadata?: Record<string, string>) {
    const sha = metadata?.['checksum-sha256']
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ...(metadata ? { Metadata: metadata } : {}),
      ...(sha ? { ChecksumAlgorithm: 'SHA256', ChecksumSHA256: sha } : {}),
      ...(!this.endpoint ? { ServerSideEncryption: 'AES256' as const } : {}),
    }))
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}

/** Local disk storage for environments where S3 is not configured or as fallback. */
export class LocalParticipantImportStorage implements ParticipantImportStorage {
  private readonly baseDir: string
  private readonly meta = new Map<string, ImportObjectMetadata>()

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(tmpdir(), 'hmi_participant_imports')
  }

  private filePath(key: string) {
    const safeKey = key.replace(/[^a-zA-Z0-9_\-./]/g, '_')
    return join(this.baseDir, safeKey)
  }

  async createUploadUrl(input: { key: string; uploadId: string; contentType: string; checksumSha256: string }) {
    return {
      url: `/api/events/upload/${input.uploadId}`,
      headers: { 'content-type': input.contentType },
      expiresAt: new Date(Date.now() + 600_000),
    }
  }

  async head(key: string): Promise<ImportObjectMetadata> {
    const cached = this.meta.get(key)
    if (cached) return cached
    const p = this.filePath(key)
    const stat = await fs.stat(p)
    return { fileSizeBytes: stat.size, contentType: 'text/csv', checksumSha256: '' }
  }

  async getStream(key: string): Promise<AsyncIterable<Uint8Array>> {
    const p = this.filePath(key)
    return createReadStream(p) as AsyncIterable<Uint8Array>
  }

  async put(key: string, body: string, contentType: string) {
    await this.putBytes(key, Buffer.from(body, 'utf-8'), contentType)
  }

  async putBytes(key: string, bytes: Uint8Array, contentType: string, metadata?: Record<string, string>) {
    const p = this.filePath(key)
    await fs.mkdir(join(p, '..'), { recursive: true })
    await fs.writeFile(p, bytes)
    this.meta.set(key, {
      fileSizeBytes: bytes.byteLength,
      contentType,
      checksumSha256: metadata?.['checksum-sha256'] ?? '',
      uploadId: metadata?.['upload-id'],
    })
  }

  async delete(key: string) {
    this.meta.delete(key)
    const p = this.filePath(key)
    await fs.unlink(p).catch(() => {})
  }
}

