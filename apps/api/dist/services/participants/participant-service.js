import { AppError } from '../../errors/app-error.js';
export class ParticipantService {
    repository;
    now;
    constructor(repository, now = () => new Date()) {
        this.repository = repository;
        this.now = now;
    }
    async listDiscoverableEvents(userId, input) {
        const result = await this.repository.listDiscoverableEvents(userId, input);
        return { ...result, events: result.events.map(({ accessRole, ...event }) => ({ ...event, accessRole, registrationEligible: event.status === 'published' && event.startDate > this.now() })) };
    }
    async getEventDetails(userId, eventId) {
        const event = await this.repository.findEvent(eventId);
        if (!event)
            throw new AppError(404, 'Event not found');
        const isAdmin = await this.repository.isEventAdmin(userId, eventId);
        const isMember = isAdmin || await this.repository.isEventMember(userId, eventId);
        if (event.status !== 'published' && !isMember)
            throw new AppError(404, 'Event not found');
        const registration = await this.repository.findRegistration(userId, eventId);
        return { event, accessRole: isAdmin ? 'admin' : isMember ? 'member' : null, registrationEligible: event.status === 'published' && event.startDate > this.now(), registrationStatus: registration?.status ?? null };
    }
    listMyEvents(userId, input) { return this.repository.listUserEvents(userId, input); }
    async registrationStatus(userId, eventId) {
        const event = await this.repository.findEvent(eventId);
        if (!event)
            throw new AppError(404, 'Event not found');
        return { eventId, registration: await this.repository.findRegistration(userId, eventId) ?? null };
    }
    async register(userId, eventId) {
        const event = await this.repository.findEvent(eventId);
        if (!event)
            throw new AppError(404, 'Event not found');
        if (event.status !== 'published' || event.startDate <= this.now())
            throw new AppError(422, 'This event is not open for registration');
        const result = await this.repository.register(userId, eventId, this.now());
        if (!result.registration)
            throw new AppError(422, 'This event is not open for registration');
        if (!result.created)
            throw new AppError(409, 'You are already registered for this event');
        return result.registration;
    }
    async cancel(userId, eventId) {
        const event = await this.repository.findEvent(eventId);
        if (!event)
            throw new AppError(404, 'Event not found');
        if (event.startDate <= this.now())
            throw new AppError(422, 'Registration can no longer be cancelled');
        const registration = await this.repository.cancelRegistration(userId, eventId, this.now());
        if (!registration)
            throw new AppError(404, 'Active registration not found');
        return registration;
    }
    async listEventParticipants(userId, eventId, input) {
        if (!(await this.repository.isEventAdmin(userId, eventId)))
            throw new AppError(404, 'Event not found');
        return this.repository.listEventParticipants(eventId, input);
    }
    async updateParticipantStatus(userId, eventId, participantId, status) {
        if (!(await this.repository.isEventAdmin(userId, eventId)))
            throw new AppError(404, 'Event not found');
        const registration = await this.repository.updateRegistrationStatus(eventId, participantId, status, this.now());
        if (!registration)
            throw new AppError(404, 'Registration not found');
        return registration;
    }
    listMyCertificates(userId, input) { return this.repository.listUserCertificates(userId, input); }
    async getMyCertificate(userId, certificateId) {
        const certificate = await this.repository.findOwnedCertificate(userId, certificateId);
        if (!certificate)
            throw new AppError(404, 'Certificate not found');
        return certificate;
    }
}
