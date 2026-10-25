import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { parseParticipantImportCsv } from './participant-import-csv.js';
export const PARTICIPANT_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const PARTICIPANT_IMPORT_MAX_ROWS = 20_000;
const ROW_BATCH_SIZE = 200;
const URL_LIFETIME_SECONDS = 600;
const OBJECT_RETENTION_MS = 3600_000;
export class ParticipantImportService {
    repository;
    storage;
    bucket;
    now;
    activeWorkers = new Set();
    polling;
    constructor(repository, storage, bucket, now = () => new Date()) {
        this.repository = repository;
        this.storage = storage;
        this.bucket = bucket;
        this.now = now;
    }
    async createUpload(actorId, eventId, input) {
        const bucket = this.requireStorage();
        const fileName = sanitizeFileName(input.fileName);
        if (!fileName.toLowerCase().endsWith('.csv'))
            throw new AppError(400, 'Choose a CSV file.');
        if (input.fileSizeBytes < 1 || input.fileSizeBytes > PARTICIPANT_IMPORT_MAX_BYTES)
            throw new AppError(413, 'CSV files must be smaller than 20 MB.');
        if (!['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'].includes(input.contentType))
            throw new AppError(415, 'The selected file must be a CSV.');
        if (!/^[A-Za-z0-9+/]{43}=$/.test(input.checksumSha256))
            throw new AppError(400, 'CSV checksum is invalid.');
        const id = randomUUID();
        const key = `participant-imports/${eventId}/${id}/${randomUUID()}.csv`;
        const expiresAt = new Date(this.now().getTime() + OBJECT_RETENTION_MS);
        try {
            await this.repository.createUploadSession({ id, eventId, actorUserId: actorId, bucket, objectKey: key, sourceFileName: fileName, contentType: 'text/csv', fileSizeBytes: input.fileSizeBytes, checksumSha256: input.checksumSha256, expiresAt });
        }
        catch (error) {
            throw mapRepositoryError(error, 'An import is already in progress for this event.');
        }
        return this.issueUrl({ id, objectKey: key, contentType: 'text/csv', checksumSha256: input.checksumSha256 }, eventId);
    }
    async renewUpload(actorId, eventId, jobId) {
        this.requireStorage();
        const job = await this.repository.refreshUploadUrl(actorId, eventId, jobId);
        if (!job)
            throw new AppError(404, 'Upload session not found or no longer available.');
        if (job.objectDeleted)
            throw new AppError(410, 'This upload session has expired. Select the file again.');
        return this.issueUrl({ id: job.id, objectKey: job.objectKey, contentType: job.contentType, checksumSha256: job.checksumSha256 }, eventId);
    }
    async receiveUploadFile(actorId, eventId, uploadId, bytes, contentType) {
        this.requireStorage();
        const source = await this.repository.refreshUploadUrl(actorId, eventId, uploadId);
        if (!source)
            throw new AppError(404, 'Upload session not found or no longer available.');
        if (source.objectDeleted)
            throw new AppError(410, 'This upload session has expired. Select the file again.');
        if (source.status !== 'upload_pending')
            throw new AppError(409, 'This upload session is no longer pending.');
        if (bytes.byteLength < 1 || bytes.byteLength > PARTICIPANT_IMPORT_MAX_BYTES) {
            throw new AppError(413, 'CSV files must be smaller than 20 MB.');
        }
        const sha256 = createHash('sha256').update(bytes).digest('base64');
        if (sha256 !== source.checksumSha256) {
            throw new AppError(422, 'Uploaded file content does not match the expected checksum.');
        }
        await this.storage.putBytes(source.objectKey, bytes, contentType || 'text/csv', {
            'upload-id': source.id,
            'checksum-sha256': source.checksumSha256,
        });
        return { uploadId, status: 'uploaded' };
    }
    async completeUpload(actorId, eventId, jobId, input) {
        this.requireStorage();
        const storage = this.storage;
        const source = await this.repository.refreshUploadUrl(actorId, eventId, jobId);
        if (!source)
            throw new AppError(404, 'Upload session not found or no longer available.');
        const metadata = await storage.head(source.objectKey).catch(() => {
            throw new AppError(400, 'The uploaded CSV file could not be found in storage. Please try uploading the file again.');
        });
        // 1. Session check: if storage reports an uploadId, verify it belongs to this job
        if (metadata.uploadId && metadata.uploadId !== source.id) {
            throw new AppError(422, `The file in storage belongs to a different upload session (${metadata.uploadId}). Please re-upload your CSV file.`);
        }
        // 2. File size verification: detect truncated or incomplete uploads
        if (metadata.fileSizeBytes !== source.fileSizeBytes) {
            const actualSize = metadata.fileSizeBytes < 1024 ? `${metadata.fileSizeBytes} B` : `${(metadata.fileSizeBytes / 1024).toFixed(1)} KB`;
            const expectedSize = source.fileSizeBytes < 1024 ? `${source.fileSizeBytes} B` : `${(source.fileSizeBytes / 1024).toFixed(1)} KB`;
            throw new AppError(422, `Uploaded file size mismatch: received ${actualSize}, but expected ${expectedSize}. The network transfer may have been interrupted. Please retry uploading the file.`);
        }
        // 3. Format/MIME-type verification: accept standard CSV MIME variations and ignore charset suffixes
        const isCsvMime = (type) => {
            const base = type.split(';')[0].trim().toLowerCase();
            return ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream'].includes(base);
        };
        const metaMime = metadata.contentType.split(';')[0].trim().toLowerCase();
        const sourceMime = source.contentType.split(';')[0].trim().toLowerCase();
        if (metaMime !== sourceMime && (!isCsvMime(metaMime) || !isCsvMime(sourceMime))) {
            throw new AppError(422, `Invalid file format: received "${metadata.contentType}", but a CSV file was expected ("${source.contentType}"). Please ensure your file is saved as a .csv file.`);
        }
        // 4. Cryptographic integrity check: compare SHA-256 checksums if storage provided one
        if (metadata.checksumSha256 && metadata.checksumSha256 !== source.checksumSha256) {
            throw new AppError(422, 'File integrity verification failed: the SHA-256 checksum of the uploaded file does not match your local file. The file may have been modified or corrupted during transfer. Please retry the upload.');
        }
        if (!validMapping(input.mapping))
            throw new AppError(400, 'Choose a name and email column before validating.');
        try {
            await this.repository.completeUpload(actorId, eventId, jobId, input.mapping, input.duplicatePolicy);
        }
        catch (error) {
            throw mapRepositoryError(error, 'This upload session is no longer awaiting completion.');
        }
        void this.runValidation(jobId);
        return { jobId, status: 'validating' };
    }
    async getJob(actorId, jobId) {
        const job = await this.repository.getJob(actorId, jobId);
        if (!job)
            throw new AppError(404, 'Import job not found.');
        return job;
    }
    async listJobs(actorId, eventId) {
        try {
            return await this.repository.listJobs(actorId, eventId, 30);
        }
        catch (error) {
            throw mapRepositoryError(error, 'Event admin access is required.');
        }
    }
    async confirm(actorId, jobId) {
        let job;
        try {
            job = await this.repository.confirm(actorId, jobId, this.now());
        }
        catch (error) {
            throw mapRepositoryError(error, 'This import is not ready for confirmation.');
        }
        if (!job)
            throw new AppError(404, 'Import job not found.');
        if (job.status === 'queued')
            void this.runImport(jobId);
        return job;
    }
    async cancel(actorId, jobId) {
        const job = await this.repository.cancel(actorId, jobId, this.now()).catch((error) => { throw mapRepositoryError(error, 'Import job not found.'); });
        if (!job)
            throw new AppError(404, 'Import job not found.');
        if (this.storage && job.objectKey && !job.objectDeleted) {
            try {
                await this.storage.delete(job.objectKey);
                await this.repository.markObjectDeleted(job.id, this.now());
            }
            catch { /* Sweep will retry on next tick. */ }
        }
        return job;
    }
    async createManagedParticipant(actorId, eventId, input) {
        const normalized = { ...input, email: input.email.trim().toLowerCase(), name: input.name.trim(), phone: input.phone?.trim() || null, organization: input.organization?.trim() || null };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email))
            throw new AppError(400, 'Enter a valid email address.');
        if (!normalized.name || normalized.name.length > 200 || normalized.email.length > 320 || (normalized.phone?.length ?? 0) > 50 || (normalized.organization?.length ?? 0) > 200)
            throw new AppError(400, 'Check the participant details and try again.');
        try {
            return await this.repository.addManagedParticipant(actorId, eventId, normalized, this.now());
        }
        catch (error) {
            throw mapRepositoryError(error, 'Could not add this participant.');
        }
    }
    async errorReport(actorId, jobId) {
        const job = await this.getJob(actorId, jobId);
        const csv = ['Row,Name,Email,Issue', ...job.rowErrors.map((item) => [item.row, item.name, item.email, item.reason].map(csvCell).join(','))].join('\r\n');
        return { fileName: `${sanitizeFileName(job.sourceFileName.replace(/\.csv$/i, ''))}-validation-errors.csv`, csv };
    }
    startWorker() {
        if (this.polling || !this.storage)
            return;
        void this.workerTick();
        this.polling = setInterval(() => { void this.workerTick(); }, 2_000);
        this.polling.unref?.();
    }
    requireStorage() {
        if (!this.storage || !this.bucket)
            throw new AppError(503, 'Participant import storage is not configured.');
        return this.bucket;
    }
    async issueUrl(input, eventId) {
        try {
            const result = await this.storage.createUploadUrl({ key: input.objectKey, uploadId: input.id, contentType: input.contentType, checksumSha256: input.checksumSha256 });
            return {
                uploadId: input.id,
                url: result.url,
                headers: result.headers,
                expiresAt: result.expiresAt.toISOString(),
                ...(eventId ? { fallbackUrl: `/api/events/${eventId}/participants/import/${input.id}/file` } : {}),
            };
        }
        catch {
            throw new AppError(503, 'Could not prepare secure CSV storage. Try again later.');
        }
    }
    async workerTick() {
        const now = this.now();
        const ids = await this.repository.getRunnableJobs(now, 12).catch(() => []);
        for (const id of ids) {
            if (this.activeWorkers.has(id))
                continue;
            this.activeWorkers.add(id);
            void this.runJob(id).finally(() => this.activeWorkers.delete(id));
        }
        await this.cleanupExpired(now);
    }
    async runJob(id) {
        await this.runValidation(id);
        await this.runImport(id);
    }
    async runValidation(id) {
        const storage = this.storage;
        if (!storage)
            return;
        const source = await this.repository.claimValidation(id, this.now()).catch(() => undefined);
        if (!source)
            return;
        const mapping = source.mapping;
        if (!mapping) {
            await this.repository.failJob(id, 'Column mapping was not provided.', this.now());
            return;
        }
        const counters = { totalRows: 0, validRows: 0, duplicateRows: 0, invalidRows: 0, expectedNew: 0, expectedUpdates: 0, rowErrors: [] };
        const seen = new Set();
        try {
            const batch = [];
            const flush = async () => {
                if (!batch.length)
                    return;
                const emails = [...new Set(batch.filter((row) => !row.error).map((row) => row.email))];
                const existingRows = await this.repository.findExistingEventParticipants(source.eventId, emails);
                const existing = new Map(existingRows.map((row) => [row.email, row]));
                for (const row of batch) {
                    counters.totalRows++;
                    if (counters.totalRows > PARTICIPANT_IMPORT_MAX_ROWS)
                        throw new AppError(422, `CSV contains more than ${PARTICIPANT_IMPORT_MAX_ROWS.toLocaleString()} rows.`);
                    if (row.error) {
                        counters.invalidRows++;
                        counters.rowErrors.push({ row: row.row, name: row.name, email: row.email, reason: row.error });
                        continue;
                    }
                    counters.validRows++;
                    const repeated = seen.has(row.email);
                    seen.add(row.email);
                    const existingRow = existing.get(row.email);
                    if (repeated || existingRow) {
                        counters.duplicateRows++;
                        const reason = repeated ? 'This email appears more than once in the file.' : 'This email is already registered for this event.';
                        counters.rowErrors.push({ row: row.row, name: row.name, email: row.email, reason, ...(existingRow ? { existingParticipantId: existingRow.participantId } : {}) });
                        if (source.duplicatePolicy === 'update' && (existingRow ? !existingRow.userId : true))
                            counters.expectedUpdates++;
                    }
                    else
                        counters.expectedNew++;
                }
                batch.length = 0;
                await this.repository.saveValidationProgress(id, counters, new Date(this.now().getTime() + 120_000));
            };
            for await (const row of parseParticipantImportCsv(await storage.getStream(source.objectKey), mapping)) {
                if (await this.repository.isCancelRequested(id)) {
                    await this.repository.markCancelled(id, this.now());
                    return;
                }
                batch.push(row);
                if (batch.length >= ROW_BATCH_SIZE)
                    await flush();
            }
            await flush();
            if (counters.totalRows === 0)
                throw new AppError(422, 'No participant rows were found in this CSV.');
            if (await this.repository.isCancelRequested(id)) {
                await this.repository.markCancelled(id, this.now());
                return;
            }
            await this.repository.finishValidation(id, counters, this.now());
        }
        catch (error) {
            if (await this.repository.isCancelRequested(id).catch(() => false))
                await this.repository.markCancelled(id, this.now());
            else
                await this.repository.failJob(id, error instanceof AppError ? error.message : 'Could not validate the uploaded CSV.', this.now());
            try {
                await storage.delete(source.objectKey);
                await this.repository.markObjectDeleted(id, this.now());
            }
            catch { /* Handled on next sweep */ }
        }
    }
    async runImport(id) {
        const storage = this.storage;
        if (!storage)
            return;
        const source = await this.repository.claimImport(id, this.now()).catch(() => undefined);
        if (!source)
            return;
        if (!source.mapping) {
            await this.repository.failJob(id, 'Column mapping was not provided.', this.now());
            return;
        }
        let cursor = source.processedRows;
        let rowNumber = 0;
        let batch = [];
        try {
            const flush = async () => {
                if (!batch.length)
                    return;
                if (await this.repository.isCancelRequested(id)) {
                    await this.repository.markCancelled(id, this.now());
                    batch = [];
                    return;
                }
                const result = await this.repository.applyImportChunk(id, batch, this.now());
                cursor += result.processed;
                batch = [];
            };
            for await (const row of parseParticipantImportCsv(await storage.getStream(source.objectKey), source.mapping)) {
                rowNumber++;
                if (rowNumber <= source.processedRows)
                    continue;
                batch.push(row);
                if (batch.length >= ROW_BATCH_SIZE)
                    await flush();
                if (await this.repository.isCancelRequested(id)) {
                    await this.repository.markCancelled(id, this.now());
                    batch = [];
                    return;
                }
            }
            await flush();
            if (cursor >= source.totalRows && !(await this.repository.isCancelRequested(id))) {
                await this.repository.finishImport(id, this.now());
                try {
                    await storage.delete(source.objectKey);
                    await this.repository.markObjectDeleted(id, this.now());
                }
                catch (err) {
                    console.error('Failed to delete temporary CSV file after import completion:', err);
                }
            }
            else if (await this.repository.isCancelRequested(id)) {
                await this.repository.markCancelled(id, this.now());
                try {
                    await storage.delete(source.objectKey);
                    await this.repository.markObjectDeleted(id, this.now());
                }
                catch { }
            }
        }
        catch (error) {
            if (await this.repository.isCancelRequested(id).catch(() => false))
                await this.repository.markCancelled(id, this.now());
            else
                await this.repository.failJob(id, error instanceof AppError ? error.message : 'The participant import stopped unexpectedly. Retry to resume from the last saved batch.', this.now());
        }
    }
    async cleanupExpired(now) {
        const storage = this.storage;
        if (!storage)
            return;
        const expired = await this.repository.expiredObjects(now, 20).catch(() => []);
        for (const object of expired) {
            try {
                await storage.delete(object.objectKey);
                await this.repository.markObjectDeleted(object.id, now);
            }
            catch { /* Retry on the next worker tick. */ }
        }
    }
}
export function sanitizeFileName(value) {
    const leaf = value.replace(/\\/g, '/').split('/').pop() ?? 'participants.csv';
    const sanitized = leaf.replace(/[\u0000-\u001f\u007f"/\\]/g, '').trim().slice(0, 120);
    return sanitized || 'participants.csv';
}
function validMapping(value) {
    if (!value || !Number.isInteger(value.name) || !Number.isInteger(value.email) || value.name < 0 || value.email < 0)
        return false;
    for (const optional of [value.phone, value.organization])
        if (optional !== undefined && (!Number.isInteger(optional) || optional < 0))
            return false;
    return new Set([value.name, value.email, value.phone, value.organization].filter((index) => index !== undefined)).size === [value.name, value.email, value.phone, value.organization].filter((index) => index !== undefined).length;
}
function csvCell(value) {
    const raw = String(value);
    const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function mapRepositoryError(error, fallback) {
    if (error instanceof AppError)
        return error;
    const message = error instanceof Error ? error.message : '';
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (/admin access|required/i.test(message))
        return new AppError(404, 'Event not found.');
    if (/already in progress|already registered|already assigned/i.test(message) || (code === '23505' && /already in progress/i.test(fallback)))
        return new AppError(409, /already registered|already assigned/i.test(message) ? message : fallback);
    if (/no eligible/i.test(message))
        return new AppError(422, message);
    if (/not ready for confirmation/i.test(message))
        return new AppError(409, message);
    return new AppError(500, fallback);
}
