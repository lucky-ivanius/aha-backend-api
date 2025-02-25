import { Hono } from "hono";
import { validator } from "hono/validator";
import { getConnInfo } from "@hono/node-server/conninfo";
import { and, eq } from "drizzle-orm";

import db from "../../lib/db/drizzle";
import schema from "../../lib/db/schema/drizzle";

import { getClerkUser, verifyClerkToken } from "../../lib/auth/clerk";

import {
  errors,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "../../utils/response";
import { zodSchemaValidator } from "../../utils/validator";

import { bearerAuthHeaderSchema } from "../../validations/auth";

const { users, sessions, userProviders } = schema;

const clerkAuthHandlers = new Hono();

clerkAuthHandlers.post(
  "/signin/clerk",
  validator("header", zodSchemaValidator(bearerAuthHeaderSchema)),
  async (c) => {
    const { authorization: token } = c.req.valid("header");
    const userAgent = c.req.header("User-Agent");
    const connInfo = getConnInfo(c);

    try {
      const clerkUserId = await verifyClerkToken(token);
      if (!clerkUserId)
        return sendUnauthorized(c, errors.UNAUTHORIZED_ERROR, "Invalid token");

      const clerkUser = await getClerkUser(clerkUserId);
      if (!clerkUser)
        return sendUnauthorized(c, errors.UNAUTHORIZED_ERROR, "Invalid token");

      const [existingUser] = await db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(users)
        .leftJoin(userProviders, eq(userProviders.userId, users.id))
        .where(
          and(
            eq(userProviders.provider, "clerk"),
            eq(userProviders.externalId, clerkUserId),
          ),
        );

      const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7); // 7 days

      if (!existingUser) {
        if (!clerkUser.emailAddresses.length) return sendUnauthorized(c);

        const email = clerkUser.emailAddresses[0].emailAddress;

        const { user, session } = await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({
              email,
              name: clerkUser.fullName ?? email,
            })
            .returning({
              id: users.id,
              email: users.email,
            })
            .execute();
          if (!user) return tx.rollback();

          const [authProvider] = await tx
            .insert(userProviders)
            .values({
              provider: "clerk",
              externalId: clerkUserId,
              userId: user.id,
            })
            .returning({
              id: userProviders.id,
            })
            .execute();
          if (!authProvider) return tx.rollback();

          const [session] = await tx
            .insert(sessions)
            .values({
              expiresAt,
              userId: user.id,
              ipAddress: connInfo.remote.address ?? "0.0.0.0",
              userAgent: userAgent,
            })
            .returning({
              id: sessions.id,
            })
            .execute();
          if (!session) return tx.rollback();

          return {
            user,
            session,
          };
        });

        return sendOk(c, { user: user, accessToken: session.id });
      }

      const [session] = await db
        .insert(sessions)
        .values({
          expiresAt,
          userId: existingUser.id,
          ipAddress: connInfo.remote.address ?? "0.0.0.0",
          userAgent: userAgent,
        })
        .returning({
          id: sessions.id,
        })
        .execute();

      return sendOk(c, { user: existingUser, accessToken: session.id });
    } catch (_error) {
      return sendUnexpected(c);
    }
  },
);

export default clerkAuthHandlers;
