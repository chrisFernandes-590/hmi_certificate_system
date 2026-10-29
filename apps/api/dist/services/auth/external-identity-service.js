import { and, eq } from "drizzle-orm";
import { externalIdentities } from "../../db/schema/auth.js";
import { users } from "../../db/schema/users.js";
export class ExternalIdentityService {
    db;
    constructor(db) {
        this.db = db;
    }
    async resolveUserFromClaims(claims) {
        const provider = "cognito";
        const subject = claims.sub;
        // 1. Check if external identity is already mapped
        const [existingMapping] = await this.db
            .select({
            user: {
                id: users.id,
                name: users.name,
                email: users.email,
                emailVerifiedAt: users.emailVerifiedAt,
            },
        })
            .from(externalIdentities)
            .innerJoin(users, eq(users.id, externalIdentities.userId))
            .where(and(eq(externalIdentities.provider, provider), eq(externalIdentities.subject, subject)))
            .limit(1);
        if (existingMapping) {
            return existingMapping.user;
        }
        // 2. If claims contain email, link or create user
        if (!claims.email) {
            // Access tokens without email claims cannot auto-provision; user must be mapped first
            return undefined;
        }
        const normalizedEmail = claims.email.trim().toLowerCase();
        // Check if user already exists with this email
        const [existingUser] = await this.db
            .select({
            id: users.id,
            name: users.name,
            email: users.email,
            emailVerifiedAt: users.emailVerifiedAt,
        })
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);
        if (existingUser) {
            // Per Rule 5: Only link automatically if both Cognito and local email are verified
            if (claims.emailVerified && existingUser.emailVerifiedAt) {
                await this.db
                    .insert(externalIdentities)
                    .values({
                    userId: existingUser.id,
                    provider,
                    subject,
                })
                    .onConflictDoNothing();
                return existingUser;
            }
            return undefined;
        }
        // 3. User does not exist, provision new user with immutable UUID
        const emailVerifiedAt = claims.emailVerified ? new Date() : null;
        const displayName = claims.name?.trim() || normalizedEmail.split("@")[0];
        const [newUser] = await this.db
            .insert(users)
            .values({
            name: displayName,
            email: normalizedEmail,
            emailVerifiedAt,
        })
            .returning({
            id: users.id,
            name: users.name,
            email: users.email,
            emailVerifiedAt: users.emailVerifiedAt,
        });
        if (newUser) {
            await this.db.insert(externalIdentities).values({
                userId: newUser.id,
                provider,
                subject,
            });
            return newUser;
        }
        return undefined;
    }
}
