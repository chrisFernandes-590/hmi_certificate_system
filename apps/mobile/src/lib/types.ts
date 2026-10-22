/** API response shapes not (yet) exported by @hmi/shared. Mirrors apps/api routes/services. */
import type { EventDto, EventMemberRole } from '@hmi/shared'

export type RegistrationStatus = 'registered' | 'attended' | 'absent' | 'cancelled'
export type CertificateStatus = 'draft' | 'issued' | 'revoked'

export type Paged = { total: number; page: number; pageSize: number }

export type DiscoverableEvent = Omit<EventDto, 'accessRole'> & {
  accessRole: EventMemberRole | null
  registrationEligible?: boolean
}
export type EventListResponse = Paged & { events: DiscoverableEvent[] }

export type EventDetail = Omit<EventDto, 'accessRole'> & {
  accessRole: EventMemberRole | null
  registrationEligible?: boolean
  registrationStatus?: string | null
}

export type MyEvent = Omit<EventDto, 'accessRole'> & {
  registrationId: string
  registrationStatus: RegistrationStatus
  registeredAt: string
}
export type MyEventsResponse = Paged & { events: MyEvent[] }

export type Registration = {
  id: string
  eventId: string
  status: RegistrationStatus
  registeredAt: string
  updatedAt: string
}
export type RegistrationResponse = { eventId: string; registration: Registration | null }
export type RegistrationMutation = {
  eventId: string
  membershipId: string
  registrationStatus: RegistrationStatus
  registeredAt: string
  updatedAt: string
}

export type Participant = {
  participantId: string
  userId: string
  name: string
  email: string
  registrationId: string
  status: RegistrationStatus
  registeredAt: string
}
export type ParticipantsResponse = Paged & { participants: Participant[] }

export type MyCertificate = {
  id: string
  certificateNumber: string
  participantId: string
  eventId: string
  eventName: string
  title: string
  description: string | null
  status: CertificateStatus
  issuedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}
export type MyCertificatesResponse = Paged & { certificates: MyCertificate[] }

export type EventCertificate = {
  id: string
  certificateNumber: string
  participantId: string
  participantName: string
  title: string
  status: CertificateStatus
  issuedAt: string | null
  revokedAt: string | null
  createdAt: string
}
export type EventCertificatesResponse = Paged & { certificates: EventCertificate[] }

export type IssuedCertificate = {
  id: string
  certificateNumber: string
  eventId: string
  participantId: string
  title: string
  status: 'issued'
  issuedAt: string
  verificationUrl: string
}

export type BulkIssueResult =
  | { participantId: string; success: true; certificate: IssuedCertificate }
  | { participantId: string; success: false; error: { statusCode: number; message: string } }
export type BulkIssueResponse = { results: BulkIssueResult[]; issuedCount: number; failedCount: number }

export type RevocationResult = {
  id: string
  certificateNumber: string
  status: 'revoked'
  revokedAt: string
  alreadyRevoked: boolean
}

export type VerifyResponse =
  | { result: 'not_found'; valid: false }
  | {
      result: 'valid' | 'revoked'
      valid: boolean
      certificate: {
        certificateNumber: string
        title: string
        participantName: string
        eventName: string
        issuedAt: string | null
        revokedAt: string | null
      }
    }
