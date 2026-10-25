import { AppError } from '../../errors/app-error.js';
export class EventService {
    repository;
    now;
    constructor(repository, now = () => new Date()) {
        this.repository = repository;
        this.now = now;
    }
    async create(userId, input) {
        this.validateDateRange(input.startDate, input.endDate);
        return this.repository.createWithAdminMembership(userId, input);
    }
    listAccessible(userId) {
        return this.repository.listAccessible(userId);
    }
    getAdminDashboardStats(userId) {
        return this.repository.getAdminDashboardStats(userId);
    }
    async getAccessible(userId, eventId) {
        const event = await this.repository.findAccessible(userId, eventId);
        if (!event)
            throw new AppError(404, 'Event not found');
        return event;
    }
    async updateAsAdmin(userId, eventId, input) {
        const current = await this.getAccessible(userId, eventId);
        if (current.accessRole !== 'admin')
            throw new AppError(403, 'Event admin access is required');
        const startDate = input.startDate ?? current.startDate;
        const endDate = input.endDate === undefined ? current.endDate : input.endDate;
        this.validateDateRange(startDate, endDate);
        const updated = await this.repository.update(eventId, input, this.now());
        if (!updated)
            throw new AppError(404, 'Event not found');
        return updated;
    }
    async archiveAsAdmin(userId, eventId) {
        const current = await this.getAccessible(userId, eventId);
        if (current.accessRole !== 'admin')
            throw new AppError(403, 'Event admin access is required');
        const archived = await this.repository.archive(eventId, this.now());
        if (!archived)
            throw new AppError(404, 'Event not found');
        return archived;
    }
    validateDateRange(startDate, endDate) {
        if (!Number.isFinite(startDate.getTime()) || (endDate && !Number.isFinite(endDate.getTime()))) {
            throw new AppError(400, 'Event dates must be valid');
        }
        if (endDate && endDate < startDate)
            throw new AppError(400, 'Event end date must be on or after the start date');
    }
}
