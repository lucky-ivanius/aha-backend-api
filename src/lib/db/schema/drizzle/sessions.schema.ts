import { relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { generateRandomHex } from "../../../token/hex";

import { users } from "./users.schema";
import { timestamps } from "./timestamps";

// Table
export const sessions = pgTable("sessions", {
  id: varchar()
    .$defaultFn(() => generateRandomHex(32))
    .primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar({ length: 45 }).notNull(),
  userAgent: text(),
  isRevoked: boolean().default(false).notNull(),
  lastActiveAt: timestamp().defaultNow().notNull(),
  expiresAt: timestamp().notNull(),
  ...timestamps,
});

// Relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
