import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { authSessions, emailVerificationTokens, passwordResetTokens, userCredentials, users, profiles, } from "../../db/schema.js";
const userColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
    emailVerifiedAt: users.emailVerifiedAt,
};
function mapAccount(row) {
    return {
        user: {
            id: row.id,
            name: row.name,
            email: row.email,
            emailVerifiedAt: row.emailVerifiedAt,
        },
        passwordHash: row.passwordHash,
    };
}
export class DrizzleAuthRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findAccountByEmail(email) {
        const [row] = await this.db
            .select({ ...userColumns, passwordHash: userCredentials.passwordHash })
            .from(users)
            .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
            .where(eq(users.email, email))
            .limit(1);
        return row ? mapAccount(row) : undefined;
    }
    async createAccount(input) {
        return this.db.transaction(async (tx) => {
            const [inserted] = await tx
                .insert(users)
                .values({ name: input.name, email: input.email })
                .onConflictDoNothing({ target: users.email })
                .returning(userColumns);
            if (inserted) {
                await tx.insert(userCredentials).values({ userId: inserted.id, passwordHash: input.passwordHash });
                await tx.insert(profiles).values({ userId: inserted.id, type: "participant", displayName: inserted.name, roleLabel: "other" });
                return { user: inserted, created: true };
            }
            const [existing] = await tx
                .select(userColumns)
                .from(users)
                .where(eq(users.email, input.email))
                .limit(1);
            if (!existing)
                throw new Error("Account insert conflict did not resolve to an existing user");
            return { user: existing, created: false };
        });
    }
    async issueEmailVerification(userId, tokenHash, expiresAt, now) {
        await this.db.transaction(async (tx) => {
            await tx
                .update(emailVerificationTokens)
                .set({ consumedAt: now })
                .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.consumedAt)));
            await tx.insert(emailVerificationTokens).values({ userId, tokenHash, expiresAt });
        });
    }
    async consumeEmailVerification(tokenHash, now) {
        return this.db.transaction(async (tx) => {
            const [token] = await tx
                .update(emailVerificationTokens)
                .set({ consumedAt: now })
                .where(and(eq(emailVerificationTokens.tokenHash, tokenHash), isNull(emailVerificationTokens.consumedAt), gt(emailVerificationTokens.expiresAt, now)))
                .returning({ userId: emailVerificationTokens.userId });
            if (!token)
                return undefined;
            await tx
                .update(users)
                .set({ emailVerifiedAt: now, updatedAt: now })
                .where(and(eq(users.id, token.userId), isNull(users.emailVerifiedAt)));
            const [user] = await tx.select(userColumns).from(users).where(eq(users.id, token.userId)).limit(1);
            return user;
        });
    }
    async createSession(userId, tokenHash, expiresAt) {
        const [active] = await this.db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.type, "organizer"), eq(profiles.status, "active"), eq(profiles.approvalStatus, "approved"))).limit(1);
        const [participant] = active ? [] : await this.db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.type, "participant"))).limit(1);
        await this.db.insert(authSessions).values({ userId, tokenHash, expiresAt, activeProfileId: active?.id ?? participant?.id });
    }
    async findActiveSession(tokenHash, now) {
        const [user] = await this.db
            .select(userColumns)
            .from(authSessions)
            .innerJoin(users, eq(authSessions.userId, users.id))
            .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, now), isNotNull(users.emailVerifiedAt)))
            .limit(1);
        return user;
    }
    async revokeSession(tokenHash, now) {
        await this.db
            .update(authSessions)
            .set({ revokedAt: now })
            .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
    }
    async findPasswordResetUser(tokenHash, now) {
        const [token] = await this.db
            .select({ userId: passwordResetTokens.userId })
            .from(passwordResetTokens)
            .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.consumedAt), gt(passwordResetTokens.expiresAt, now)))
            .limit(1);
        return token?.userId;
    }
    async issuePasswordReset(userId, tokenHash, expiresAt, now) {
        await this.db.transaction(async (tx) => {
            await tx
                .update(passwordResetTokens)
                .set({ consumedAt: now })
                .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.consumedAt)));
            await tx.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
        });
    }
    async resetPassword(tokenHash, passwordHash, now) {
        return this.db.transaction(async (tx) => {
            const [token] = await tx
                .update(passwordResetTokens)
                .set({ consumedAt: now })
                .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.consumedAt), gt(passwordResetTokens.expiresAt, now)))
                .returning({ userId: passwordResetTokens.userId });
            if (!token)
                return false;
            const [credential] = await tx
                .update(userCredentials)
                .set({ passwordHash, updatedAt: now })
                .where(eq(userCredentials.userId, token.userId))
                .returning({ userId: userCredentials.userId });
            if (!credential)
                throw new Error("Password reset token has no local credential");
            await tx
                .update(authSessions)
                .set({ revokedAt: now })
                .where(and(eq(authSessions.userId, token.userId), isNull(authSessions.revokedAt)));
            return true;
        });
    }
}
