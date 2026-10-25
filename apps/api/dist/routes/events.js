import { Hono } from 'hono';
import { z } from 'zod';
import { createEventSchema, updateEventSchema } from '@hmi/shared';
import { AppError } from '../errors/app-error.js';
import { successResponse } from '../lib/api-response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.js';
async function parseBody(c, schema) {
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        throw new AppError(400, 'Request body must be valid JSON');
    }
    return schema.parse(body);
}
function toEventDto(event) {
    return {
        id: event.id,
        name: event.name,
        description: event.description,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString() ?? null,
        status: event.status,
        ownerId: event.ownerId,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
    };
}
export async function listEventsResponse(c, events, participants) {
    if (participants) {
        const query = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().min(1).max(100).optional() }).safeParse(c.req.query());
        if (!query.success)
            throw new AppError(400, 'Invalid query parameters', query.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })));
        const result = await participants.listDiscoverableEvents(c.get('authUser').id, query.data);
        return successResponse(c, { ...result, events: result.events.map(({ accessRole, participantCount, eligibleParticipantCount, issuedCertificateCount, ...event }) => ({
                ...toEventDto(event), accessRole,
                participantCount: accessRole === 'admin' ? participantCount : null,
                // This release has no pending approval registration status yet.
                pendingParticipantCount: null,
                eligibleParticipantCount: accessRole === 'admin' ? eligibleParticipantCount ?? null : null,
                issuedCertificateCount: accessRole === 'admin' ? issuedCertificateCount ?? null : null,
                registrationEligible: event.registrationEligible,
            })), page: query.data.page, pageSize: query.data.pageSize });
    }
    const accessibleEvents = await events.listAccessible(c.get('authUser').id);
    return successResponse(c, { events: accessibleEvents.map(({ accessRole, ...event }) => ({ ...toEventDto(event), accessRole })) });
}
export function createEventRoutes(auth, events, webOrigin, participants) {
    const routes = new Hono();
    const requireAuth = createAuthMiddleware(auth);
    const requireCsrf = createCsrfMiddleware(webOrigin);
    const listEvents = asyncHandler((c) => listEventsResponse(c, events, participants));
    routes.get('/', requireAuth, listEvents);
    routes.get('', requireAuth, listEvents);
    routes.get('/admin-dashboard', requireAuth, asyncHandler(async (c) => {
        return successResponse(c, await events.getAdminDashboardStats(c.get('authUser').id));
    }));
    routes.post('/', requireAuth, requireCsrf, asyncHandler(async (c) => {
        const input = await parseBody(c, createEventSchema);
        const event = await events.create(c.get('authUser').id, {
            name: input.name,
            description: input.description ?? null,
            startDate: new Date(input.startDate),
            endDate: input.endDate ? new Date(input.endDate) : null,
            status: input.status ?? 'draft',
        });
        const { accessRole, ...eventRecord } = event;
        return successResponse(c, { event: { ...toEventDto(eventRecord), accessRole } }, 201);
    }));
    routes.get('/:eventId', requireAuth, asyncHandler(async (c) => {
        if (participants) {
            const result = await participants.getEventDetails(c.get('authUser').id, parseEventId(c.req.param('eventId')));
            return successResponse(c, { event: { ...toEventDto(result.event), accessRole: result.accessRole, registrationEligible: result.registrationEligible, registrationStatus: result.registrationStatus } });
        }
        const event = await events.getAccessible(c.get('authUser').id, parseEventId(c.req.param('eventId')));
        const { accessRole, ...eventRecord } = event;
        return successResponse(c, { event: { ...toEventDto(eventRecord), accessRole } });
    }));
    routes.patch('/:eventId', requireAuth, requireCsrf, asyncHandler(async (c) => {
        const input = await parseBody(c, updateEventSchema);
        const databaseInput = {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.startDate === undefined ? {} : { startDate: new Date(input.startDate) }),
            ...(input.endDate === undefined ? {} : { endDate: input.endDate === null ? null : new Date(input.endDate) }),
            ...(input.status === undefined ? {} : { status: input.status }),
        };
        const event = await events.updateAsAdmin(c.get('authUser').id, parseEventId(c.req.param('eventId')), databaseInput);
        return successResponse(c, { event: { ...toEventDto(event), accessRole: 'admin' } });
    }));
    routes.delete('/:eventId', requireAuth, requireCsrf, asyncHandler(async (c) => {
        const event = await events.archiveAsAdmin(c.get('authUser').id, parseEventId(c.req.param('eventId')));
        return successResponse(c, { event: { ...toEventDto(event), accessRole: 'admin' } });
    }));
    return routes;
}
function parseEventId(value) {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success)
        throw new AppError(400, 'Event ID must be a valid UUID');
    return parsed.data;
}
