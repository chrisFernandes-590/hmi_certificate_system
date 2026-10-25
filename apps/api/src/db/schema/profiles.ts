import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const profileTypeEnum = pgEnum("profile_type", ["participant", "organizer"]);
export const profileStatusEnum = pgEnum("profile_status", ["active", "suspended", "deleted"]);
export const profileRoleLabelEnum = pgEnum("profile_role_label", ["student", "teacher", "other"]);
export const organizerApprovalStatusEnum = pgEnum("organizer_approval_status", ["not_requested", "pending", "approved", "rejected"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: profileTypeEnum("type").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  institution: text("institution"),
  roleLabel: profileRoleLabelEnum("role_label").notNull().default("other"),
  bio: text("bio"),
  status: profileStatusEnum("status").notNull().default("active"),
  approvalStatus: organizerApprovalStatusEnum("approval_status").notNull().default("not_requested"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("profiles_user_type_uidx").on(table.userId, table.type),
  index("profiles_user_id_idx").on(table.userId),
]);

export type Profile = typeof profiles.$inferSelect;
