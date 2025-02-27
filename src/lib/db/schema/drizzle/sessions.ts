import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 } from "uuid";

import { timestamps } from "./timestamps";
import { users } from "./users";

// Table
export const sessions = pgTable(
  "sessions",
  {
    id: uuid()
      .$defaultFn(() => v7())
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
  },
  (session) => [
    index("active_sessions_idx").on(
      session.userId,
      session.isRevoked,
      session.expiresAt,
    ),
  ],
);

// Relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
