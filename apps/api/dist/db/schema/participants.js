import { pgTable, uuid, text, integer, timestamp, check, uniqueIndex, } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
// ---------------------------------------------------------------------------
// participants
// Extends user accounts with profile attributes specific to certificate
// recipients. Kept separate from `users` so participant data can evolve
// independently without polluting core account identity.
// ---------------------------------------------------------------------------
export const participants = pgTable("participants", {
    id: uuid("id").primaryKey().defaultRandom(),
    // One-to-one: each user account maps to at most one participant profile.
    // Nullable for admin-managed event attendees who do not yet have an account.
    // Such profiles are never linked to a user by an unverified email address.
    userId: uuid("user_id").unique().references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    organization: text("organization"),
    // Age is optional; when supplied it must be a sensible positive value.
    age: integer("age"),
    course: text("course"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    // Application-layer age validation should also run; this is a safety net.
    check("participants_age_check", sql `${table.age} IS NULL OR (${table.age} >= 0 AND ${table.age} <= 150)`),
    check("participants_managed_contact_check", sql `${table.userId} IS NOT NULL OR (${table.name} IS NOT NULL AND ${table.email} IS NOT NULL)`),
    uniqueIndex("participants_managed_email_uidx").on(sql `lower(${table.email})`).where(sql `${table.email} IS NOT NULL`),
]);
