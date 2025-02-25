import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { sessions } from "./sessions.schema";
import { timestamps } from "./timestamps";
import { userProviders } from "./user-provider.schema";

// Table
export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  email: varchar({ length: 255 }).unique().notNull(),
  name: varchar().notNull(),
  ...timestamps,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const usersAuthProviders = relations(users, ({ many }) => ({
  userProviders: many(userProviders),
}));
