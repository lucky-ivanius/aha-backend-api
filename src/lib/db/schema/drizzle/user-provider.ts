import { relations } from "drizzle-orm";
import { boolean, index, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { timestamps } from "./timestamps";
import { users } from "./users";

// Table
export const userProviders = pgTable(
  "user_providers",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar({ length: 255 }).notNull(),
    externalId: varchar().notNull(),
    passwordEnabled: boolean().notNull(),
    ...timestamps,
  },
  (userProvider) => [
    index("provider_lookup_idx").on(
      userProvider.provider,
      userProvider.externalId,
    ),
  ],
);

// Relations
export const userProvidersRelations = relations(userProviders, ({ one }) => ({
  user: one(users, {
    fields: [userProviders.userId],
    references: [users.id],
  }),
}));
