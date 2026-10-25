import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { AppError } from '../../errors/app-error.js';
import { auditLogs, certificateAssets, certificates, eventMemberships, eventRegistrations, events, participants, users } from '../../db/schema.js';
export class DrizzleCertificateRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findAdminEvent(actorId, eventId) {
        const [row] = await this.db.select({ id: events.id, name: events.name }).from(events)
            .innerJoin(eventMemberships, eq(eventMemberships.eventId, events.id))
            .where(and(eq(events.id, eventId), eq(eventMemberships.userId, actorId), eq(eventMemberships.role, 'admin'), isNull(events.archivedAt)))
            .limit(1);
        return row;
    }
    async findEligibleRecipient(eventId, participantId) {
        const [row] = await this.db.select({ participantId: participants.id, userId: participants.userId, name: sql `coalesce(${users.name}, ${participants.name}, '')`, registrationStatus: eventRegistrations.status })
            .from(eventRegistrations).innerJoin(participants, eq(eventRegistrations.participantId, participants.id))
            .leftJoin(users, eq(participants.userId, users.id))
            .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.participantId, participantId), inArray(eventRegistrations.status, ['registered', 'attended'])))
            .limit(1);
        return row;
    }
    async createDraft(input) {
        try {
            const [row] = await this.db.insert(certificates).values({
                id: input.id,
                certificateNumber: input.certificateNumber,
                verificationToken: input.verificationToken,
                participantId: input.participantId,
                eventId: input.eventId,
                issuerId: input.issuerId,
                issuerNameSnapshot: input.issuerName,
                participantNameSnapshot: input.participantName,
                eventNameSnapshot: input.eventName,
                title: input.title,
                description: input.description,
                status: 'draft',
            }).returning({ id: certificates.id });
            return row;
        }
        catch (error) {
            if (isUniqueViolation(error, 'certificates_event_participant_uidx'))
                throw new AppError(409, 'A certificate already exists for this participant and event');
            if (isUniqueViolation(error))
                throw new AppError(503, 'Could not reserve a unique certificate identifier; retry the request');
            throw error;
        }
    }
    async completeIssuance(input) {
        return this.db.transaction(async (tx) => {
            const [row] = await tx.update(certificates).set({ status: 'issued', issuedAt: input.issuedAt, updatedAt: input.issuedAt })
                .where(and(eq(certificates.id, input.certificateId), eq(certificates.status, 'draft')))
                .returning({ id: certificates.id, certificateNumber: certificates.certificateNumber, eventId: certificates.eventId, participantId: certificates.participantId, title: certificates.title });
            if (!row)
                throw new AppError(409, 'Certificate issuance is no longer pending');
            await tx.insert(certificateAssets).values({ certificateId: row.id, type: 'pdf', storageKey: input.storageKey, mimeType: 'application/pdf', fileSizeBytes: input.fileSizeBytes, checksumSha256: input.checksumSha256 });
            await tx.insert(auditLogs).values({ actorUserId: input.actorId, action: 'CERTIFICATE_ISSUED', entityType: 'certificate', entityId: row.id, metadata: { eventId: row.eventId, participantId: row.participantId, certificateNumber: row.certificateNumber } });
            return { ...row, status: 'issued', issuedAt: input.issuedAt, verificationUrl: input.verificationUrl };
        });
    }
    async deleteDraft(certificateId) {
        await this.db.delete(certificates).where(and(eq(certificates.id, certificateId), eq(certificates.status, 'draft')));
    }
    async recordPendingCleanup(input) {
        await this.db.transaction(async (tx) => {
            await tx.insert(certificateAssets).values({ certificateId: input.certificateId, type: 'pdf', storageKey: input.storageKey, mimeType: 'application/pdf', fileSizeBytes: input.fileSizeBytes, checksumSha256: input.checksumSha256 });
            await tx.insert(auditLogs).values({ actorUserId: input.actorId, action: 'CERTIFICATE_STORAGE_CLEANUP_PENDING', entityType: 'certificate', entityId: input.certificateId, metadata: { storageKey: input.storageKey } });
        });
    }
    async findOwnedPdf(userId, certificateId) {
        const [row] = await this.db.select({ ownerUserId: users.id, certificateNumber: certificates.certificateNumber, status: certificates.status, storageKey: certificateAssets.storageKey, mimeType: certificateAssets.mimeType, checksumSha256: certificateAssets.checksumSha256 })
            .from(certificates).innerJoin(participants, eq(certificates.participantId, participants.id))
            .innerJoin(users, eq(participants.userId, users.id))
            .innerJoin(certificateAssets, and(eq(certificateAssets.certificateId, certificates.id), eq(certificateAssets.type, 'pdf')))
            .where(and(eq(certificates.id, certificateId), eq(participants.userId, userId), inArray(certificates.status, ['issued', 'revoked'])))
            .limit(1);
        return row;
    }
    async listEventCertificates(eventId, input) {
        const where = and(eq(certificates.eventId, eventId), input.status ? eq(certificates.status, input.status) : undefined, input.search ? or(ilike(certificates.certificateNumber, `%${input.search}%`), ilike(certificates.participantNameSnapshot, `%${input.search}%`), ilike(certificates.title, `%${input.search}%`)) : undefined);
        const [totalRow] = await this.db.select({ total: count() }).from(certificates).where(where);
        const rows = await this.db.select({
            id: certificates.id,
            certificateNumber: certificates.certificateNumber,
            participantId: certificates.participantId,
            participantName: certificates.participantNameSnapshot,
            title: certificates.title,
            status: certificates.status,
            issuedAt: certificates.issuedAt,
            revokedAt: certificates.revokedAt,
            createdAt: certificates.createdAt,
        }).from(certificates).where(where)
            .orderBy(desc(certificates.createdAt), asc(certificates.certificateNumber))
            .limit(input.pageSize).offset((input.page - 1) * input.pageSize);
        return { certificates: rows, total: totalRow.total };
    }
    async revoke(actorId, certificateId, reason, now) {
        return this.db.transaction(async (tx) => {
            const [row] = await tx.select({ id: certificates.id, eventId: certificates.eventId, certificateNumber: certificates.certificateNumber, status: certificates.status, revokedAt: certificates.revokedAt })
                .from(certificates).innerJoin(eventMemberships, eq(eventMemberships.eventId, certificates.eventId))
                .where(and(eq(certificates.id, certificateId), eq(eventMemberships.userId, actorId), eq(eventMemberships.role, 'admin')))
                .for('update').limit(1);
            if (!row)
                return undefined;
            if (row.status === 'revoked')
                return { id: row.id, certificateNumber: row.certificateNumber, status: 'revoked', revokedAt: row.revokedAt ?? now, alreadyRevoked: true };
            if (row.status !== 'issued')
                throw new AppError(409, 'Only issued certificates can be revoked');
            const [updated] = await tx.update(certificates).set({ status: 'revoked', revokedAt: now, revokedReason: reason, updatedAt: now })
                .where(and(eq(certificates.id, row.id), eq(certificates.status, 'issued')))
                .returning({ id: certificates.id, certificateNumber: certificates.certificateNumber, revokedAt: certificates.revokedAt });
            if (!updated)
                throw new AppError(409, 'Certificate status changed; retry the request');
            await tx.insert(auditLogs).values({ actorUserId: actorId, action: 'CERTIFICATE_REVOKED', entityType: 'certificate', entityId: row.id, metadata: { eventId: row.eventId, certificateNumber: row.certificateNumber, reason } });
            return { id: updated.id, certificateNumber: updated.certificateNumber, status: 'revoked', revokedAt: updated.revokedAt ?? now, alreadyRevoked: false };
        });
    }
    async verify(token) {
        const [row] = await this.db.select({ status: certificates.status, certificateNumber: certificates.certificateNumber, title: certificates.title, participantName: certificates.participantNameSnapshot, eventName: certificates.eventNameSnapshot, issuedAt: certificates.issuedAt, revokedAt: certificates.revokedAt })
            .from(certificates).where(and(eq(certificates.verificationToken, token), inArray(certificates.status, ['issued', 'revoked']))).limit(1);
        if (!row)
            return undefined;
        return { ...row, status: row.status === 'revoked' ? 'revoked' : 'valid' };
    }
}
function isUniqueViolation(error, constraint) {
    if (!error || typeof error !== 'object')
        return false;
    const value = error;
    return value.code === '23505' && (!constraint || value.constraint === constraint);
}
