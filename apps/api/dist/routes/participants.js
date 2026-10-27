import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { successResponse } from '../lib/api-response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.js';
import { requireProfileType } from '../middleware/require-profile.js';
const uuidSchema = z.uuid();
const participantStatusSchema = z.object({ status: z.enum(['registered', 'attended', 'absent']) }).strict();
const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    status: z.string().optional(),
    eventId: z.uuid().optional(),
});
function parsePage(c, allowedStatuses = []) {
    const parsed = querySchema.safeParse(c.req.query());
    if (!parsed.success)
        throw new AppError(400, 'Invalid query parameters', parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })));
    if (parsed.data.status && !allowedStatuses.includes(parsed.data.status))
        throw new AppError(400, 'Invalid status filter');
    return parsed.data;
}
function parseUuid(value, label) {
    const parsed = uuidSchema.safeParse(value);
    if (!parsed.success)
        throw new AppError(400, `${label} must be a valid UUID`);
    return parsed.data;
}
export function createParticipantRoutes(auth, participants, webOrigin, profiles) {
    const routes = new Hono();
    const requireAuth = createAuthMiddleware(auth);
    const requireCsrf = createCsrfMiddleware(webOrigin);
    const requireParticipant = requireProfileType(profiles, 'participant');
    const requireOrganizer = requireProfileType(profiles, 'organizer');
    routes.use('*', requireAuth);
    routes.get('/me/events', requireParticipant, asyncHandler(async (c) => {
        const input = parsePage(c);
        const result = await participants.listMyEvents(c.get('authUser').id, input);
        return successResponse(c, { ...result, page: input.page, pageSize: input.pageSize });
    }));
    routes.get('/me/events/:eventId/registration', requireParticipant, asyncHandler(async (c) => successResponse(c, await participants.registrationStatus(c.get('authUser').id, parseUuid(c.req.param('eventId') ?? '', 'Event ID')))));
    routes.post('/events/:eventId/registration', requireParticipant, requireCsrf, asyncHandler(async (c) => {
        const registration = await participants.register(c.get('authUser').id, parseUuid(c.req.param('eventId') ?? '', 'Event ID'));
        return successResponse(c, { eventId: registration.eventId, membershipId: registration.id, registrationStatus: registration.status, registeredAt: registration.registeredAt.toISOString(), updatedAt: registration.updatedAt.toISOString() }, 201);
    }));
    routes.delete('/events/:eventId/registration', requireParticipant, requireCsrf, asyncHandler(async (c) => {
        const registration = await participants.cancel(c.get('authUser').id, parseUuid(c.req.param('eventId') ?? '', 'Event ID'));
        return successResponse(c, { eventId: registration.eventId, membershipId: registration.id, registrationStatus: registration.status, registeredAt: registration.registeredAt.toISOString(), updatedAt: registration.updatedAt.toISOString() });
    }));
    routes.get('/me/certificates', requireParticipant, asyncHandler(async (c) => {
        const input = parsePage(c, ['draft', 'issued', 'revoked']);
        const result = await participants.listMyCertificates(c.get('authUser').id, input);
        return successResponse(c, { ...result, page: input.page, pageSize: input.pageSize });
    }));
    routes.get('/certificates/:certificateId', requireParticipant, asyncHandler(async (c) => {
        const certificate = await participants.getMyCertificate(c.get('authUser').id, parseUuid(c.req.param('certificateId') ?? '', 'Certificate ID'));
        return successResponse(c, { certificate: { ...certificate, issuedAt: certificate.issuedAt?.toISOString() ?? null, revokedAt: certificate.revokedAt?.toISOString() ?? null, createdAt: certificate.createdAt.toISOString(), updatedAt: certificate.updatedAt.toISOString() } });
    }));
    routes.get('/events/:eventId/participants', requireOrganizer, asyncHandler(async (c) => {
        const input = parsePage(c, ['registered', 'attended', 'absent', 'cancelled']);
        const result = await participants.listEventParticipants(c.get('authUser').id, parseUuid(c.req.param('eventId') ?? '', 'Event ID'), input);
        return successResponse(c, { ...result, page: input.page, pageSize: input.pageSize });
    }));
    routes.patch('/events/:eventId/participants/:participantId', requireOrganizer, requireCsrf, asyncHandler(async (c) => {
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            throw new AppError(400, 'Request body must be valid JSON');
        }
        const parsed = participantStatusSchema.safeParse(body);
        if (!parsed.success)
            throw new AppError(400, 'Invalid participant status', parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })));
        const registration = await participants.updateParticipantStatus(c.get('authUser').id, parseUuid(c.req.param('eventId') ?? '', 'Event ID'), parseUuid(c.req.param('participantId') ?? '', 'Participant ID'), parsed.data.status);
        return successResponse(c, { registration: { ...registration, registeredAt: registration.registeredAt.toISOString(), updatedAt: registration.updatedAt.toISOString() } });
    }));
    return routes;
}
