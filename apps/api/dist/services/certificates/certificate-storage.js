import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
export class StorageObjectNotFoundError extends Error {
    constructor() { super('Storage object not found'); this.name = 'StorageObjectNotFoundError'; }
}
/** Uses the AWS SDK default credential chain; EC2 deployments should attach an instance role. */
export class S3CertificateStorage {
    client;
    bucket;
    serverSideEncryption;
    constructor(client, bucket, serverSideEncryption) {
        this.client = client;
        this.bucket = bucket;
        this.serverSideEncryption = serverSideEncryption;
    }
    async put(key, bytes, contentType) {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
            ...(this.serverSideEncryption ? { ServerSideEncryption: this.serverSideEncryption } : {}),
        }));
    }
    async get(key) {
        try {
            const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
            if (!result.Body)
                throw new StorageObjectNotFoundError();
            return { bytes: await result.Body.transformToByteArray(), contentType: result.ContentType ?? 'application/pdf' };
        }
        catch (error) {
            if (isMissingObject(error))
                throw new StorageObjectNotFoundError();
            throw error;
        }
    }
    async delete(key) {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
}
function isMissingObject(error) {
    if (!error || typeof error !== 'object')
        return false;
    const value = error;
    return value.name === 'NoSuchKey' || value.name === 'NotFound' || value.$metadata?.httpStatusCode === 404;
}
