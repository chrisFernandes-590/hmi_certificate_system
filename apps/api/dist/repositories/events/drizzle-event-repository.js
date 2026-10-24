import { and, asc, eq, isNull } from 'drizzle-orm';
import { eventMemberships, events } from '../../db/schema.js';
const eventColumns = {
    id: events.id,
    name: events.name,
    description: events.description,
    startDate: events.startDate,
    endDate: events.endDate,
    status: events.status,
    ownerId: events.ownerId,
    createdAt: events.createdAt,
    updatedAt: events.updatedAt,
    archivedAt: events.archivedAt,
};
export class DrizzleEventRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createWithAdminMembership(creatorId, input) {
        return this.db.transaction(async (tx) => {
            const [event] = await tx.insert(events).values({ ...input, ownerId: creatorId }).returning(eventColumns);
            await tx.insert(eventMemberships).values({ eventId: event.id, userId: creatorId, role: 'admin' });
            return { ...event, accessRole: 'admin' };
        });
    }
    async listAccessible(userId) {
        return this.db
            .select({ ...eventColumns, accessRole: eventMemberships.role })
            .from(eventMemberships)
            .innerJoin(events, eq(eventMemberships.eventId, events.id))
            .where(and(eq(eventMemberships.userId, userId), isNull(events.archivedAt)))
            .orderBy(asc(events.startDate), asc(events.createdAt));
    }
    async findAccessible(userId, eventId) {
        const [event] = await this.db
            .select({ ...eventColumns, accessRole: eventMemberships.role })
            .from(eventMemberships)
            .innerJoin(events, eq(eventMemberships.eventId, events.id))
            .where(and(eq(eventMemberships.userId, userId), eq(eventMemberships.eventId, eventId), isNull(events.archivedAt)))
            .limit(1);
        return event;
    }
    async update(eventId, input, now) {
        const [event] = await this.db
            .update(events)
            .set({ ...input, updatedAt: now })
            .where(and(eq(events.id, eventId), isNull(events.archivedAt)))
            .returning(eventColumns);
        return event;
    }
    async archive(eventId, now) {
        const [event] = await this.db
            .update(events)
            .set({ archivedAt: now, updatedAt: now })
            .where(and(eq(events.id, eventId), isNull(events.archivedAt)))
            .returning(eventColumns);
        return event;
    }
}
