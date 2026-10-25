import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Database } from "../../db/index.js";
import { auditLogs, authSessions, profiles } from "../../db/schema.js";
import { AppError } from "../../errors/app-error.js";

const hashSession = (token: string) => createHash("sha256").update(token).digest("hex");

export class ProfileService {
  constructor(private readonly db: Database, private readonly organizerMode: "instant" | "requires_approval") {}

  async getForSession(userId: string, token: string) {
    const tokenHash = hashSession(token);
    const [session] = await this.db.select({ activeProfileId: authSessions.activeProfileId }).from(authSessions)
      .where(and(eq(authSessions.userId, userId), eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt))).limit(1);
    const rows = await this.db.select().from(profiles).where(eq(profiles.userId, userId));
    const active = rows.find((profile) => profile.id === session?.activeProfileId && profile.status === "active" && (profile.type !== "organizer" || profile.approvalStatus === "approved"))
      ?? rows.find((profile) => profile.type === "participant" && profile.status === "active");
    if (session && active && session.activeProfileId !== active.id) {
      await this.db.update(authSessions).set({ activeProfileId: active.id })
        .where(and(eq(authSessions.userId, userId), eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
    }
    return { profiles: rows, activeProfileId: active?.id ?? null };
  }

  async assertActiveType(userId: string, token: string, type: "participant" | "organizer") {
    const tokenHash = hashSession(token);
    const [row] = await this.db.select({ type: profiles.type, status: profiles.status, approvalStatus: profiles.approvalStatus })
      .from(authSessions).innerJoin(profiles, eq(authSessions.activeProfileId, profiles.id))
      .where(and(eq(authSessions.userId, userId), eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt))).limit(1);
    if (row?.type !== type || row.status !== "active" || (type === "organizer" && row.approvalStatus !== "approved")) {
      throw new AppError(403, `Switch to your ${type} profile to continue`, undefined, "PROFILE_MISMATCH");
    }
  }

  async switch(userId: string, token: string, type: "participant" | "organizer") {
    const [profile] = await this.db.select().from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.type, type))).limit(1);
    if (!profile || profile.status !== "active" || (type === "organizer" && profile.approvalStatus !== "approved")) {
      throw new AppError(403, type === "organizer" ? "An active organizer profile is required" : "Participant profile is unavailable");
    }
    const tokenHash = hashSession(token);
    const [session] = await this.db.update(authSessions).set({ activeProfileId: profile.id })
      .where(and(eq(authSessions.userId, userId), eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)))
      .returning({ id: authSessions.id });
    if (!session) throw new AppError(401, "Session is invalid or expired");
    await this.db.insert(auditLogs).values({ actorUserId: userId, action: "profile.switched", entityType: "profile", entityId: profile.id, metadata: { type } });
    return profile;
  }

  async createOrganizer(userId: string, input: { displayName: string; institution?: string; roleLabel: "student" | "teacher" | "other"; bio?: string }) {
    const [existing] = await this.db.select().from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.type, "organizer"))).limit(1);
    if (existing) return existing;
    const approvalStatus = this.organizerMode === "instant" ? "approved" : "pending";
    const [created] = await this.db.insert(profiles).values({
      userId, type: "organizer", displayName: input.displayName, institution: input.institution ?? null,
      roleLabel: input.roleLabel, bio: input.bio ?? null, approvalStatus,
    }).onConflictDoNothing().returning();
    const profile = created ?? (await this.db.select().from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.type, "organizer"))).limit(1))[0];
    if (!profile) throw new AppError(409, "Organizer profile could not be created. Please retry.");
    await this.db.insert(auditLogs).values({ actorUserId: userId, action: "profile.created", entityType: "profile", entityId: profile.id, metadata: { type: "organizer", approvalStatus: profile.approvalStatus } });
    return profile;
  }

  async updateParticipant(userId: string, input: { displayName: string; institution?: string; roleLabel: "student" | "teacher" | "other"; bio?: string }) {
    const [profile] = await this.db.update(profiles).set({
      displayName: input.displayName,
      institution: input.institution ?? null,
      roleLabel: input.roleLabel,
      bio: input.bio ?? null,
    }).where(and(eq(profiles.userId, userId), eq(profiles.type, "participant"), eq(profiles.status, "active"))).returning();
    if (!profile) throw new AppError(404, "Participant profile not found");
    await this.db.insert(auditLogs).values({ actorUserId: userId, action: "profile.updated", entityType: "profile", entityId: profile.id, metadata: { type: "participant" } });
    return profile;
  }
}
