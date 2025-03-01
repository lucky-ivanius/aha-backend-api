import { and, asc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import {
  INVALID_AUTH_TOKEN,
  SESSION_TOKEN_NOT_PROVIDED,
} from "../config/consts";
import env from "../config/env";

import schema from "../lib/db/schema/drizzle";

import { attachRequestId } from "../utils/logger";
import {
  sendNoContent,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "../utils/response";
import { deleteSessionCookie, setSessionCookie } from "../utils/sessions";
import { zodSchemaValidator } from "../utils/validator";
import { getIpAddress } from "../utils/ip";

import { sessionCookieMiddleware } from "../middlewares/auth";
import {
  protectedRouteRateLimitMiddleware,
  rateLimitMiddleware,
} from "../middlewares/rate-limiter";

import { AuthProvider } from "../interfaces/auth-provider";
import { bearerAuthHeaderSchema } from "../validations/auth";

declare module "hono" {
  interface ContextVariableMap {
    authProvider: AuthProvider;
  }
}

const { users, sessions, userProviders } = schema;

const authHandlers = new Hono();

authHandlers
  .post(
    "/signin",
    validator("header", zodSchemaValidator(bearerAuthHeaderSchema)),
    async (c, next) =>
      rateLimitMiddleware({
        windowMs: 1000,
        limit: 10,
        keyGenerator: (_c) => c.req.valid("header").authorization,
      })(c, next),
    async (c) => {
      const { authorization: token } = c.req.valid("header");
      const userAgent = c.req.header("User-Agent");
      const ipAddress = getIpAddress(c);

      try {
        const payload = await c.var.authProvider.verifyToken(token);
        if (!payload)
          return sendUnauthorized(
            c,
            INVALID_AUTH_TOKEN,
            "Invalid or expired authentication token",
          );

        const { userId: externalUserId } = payload;

        const [existingUser] = await c.var.db
          .select({
            id: users.id,
          })
          .from(users)
          .leftJoin(userProviders, eq(userProviders.userId, users.id))
          .where(
            and(
              eq(userProviders.provider, c.var.authProvider.name),
              eq(userProviders.externalId, externalUserId),
            ),
          );

        const expiresAt = new Date(Date.now() + env.SESSION_EXPIRATION_TIME);

        if (!existingUser) {
          const providerUser =
            await c.var.authProvider.getProviderUser(externalUserId);
          if (!providerUser)
            return sendUnauthorized(
              c,
              INVALID_AUTH_TOKEN,
              "Invalid authentication token",
            );

          const { createdUser, createdSession } = await c.var.db.transaction(
            async (tx) => {
              const [createdUser] = await tx
                .insert(users)
                .values({
                  email: providerUser.email,
                  name: providerUser.name,
                })
                .returning({
                  id: users.id,
                })
                .onConflictDoUpdate({
                  set: {
                    email: providerUser.email,
                    name: providerUser.name,
                  },
                  target: [users.email],
                })
                .execute();
              if (!createdUser) return tx.rollback();

              const [createdAuthProvider] = await tx
                .insert(userProviders)
                .values({
                  userId: createdUser.id,
                  provider: c.var.authProvider.name,
                  externalId: providerUser.id,
                  passwordEnabled: providerUser.passwordEnabled,
                })
                .returning({
                  id: userProviders.id,
                })
                .execute();
              if (!createdAuthProvider) return tx.rollback();

              const [createdSession] = await tx
                .insert(sessions)
                .values({
                  expiresAt,
                  userId: createdUser.id,
                  ipAddress: ipAddress ?? "0.0.0.0",
                  userAgent: userAgent,
                })
                .returning({
                  id: sessions.id,
                })
                .execute();
              if (!createdSession) return tx.rollback();

              const now = new Date();

              const usersActiveSessions = await tx.$count(
                sessions,
                and(
                  eq(sessions.userId, createdUser.id),
                  eq(sessions.isRevoked, false),
                  gte(sessions.expiresAt, now),
                ),
              );
              if (usersActiveSessions > env.MAX_USER_ACTIVE_SESSIONS) {
                const [oldestSession] = await tx
                  .select({
                    id: sessions.id,
                  })
                  .from(sessions)
                  .where(
                    and(
                      eq(sessions.userId, createdUser.id),
                      eq(sessions.isRevoked, false),
                      gte(sessions.expiresAt, now),
                    ),
                  )
                  .orderBy(asc(sessions.lastActiveAt))
                  .limit(1);
                if (oldestSession) {
                  await tx
                    .update(sessions)
                    .set({
                      isRevoked: true,
                    })
                    .where(eq(sessions.id, oldestSession.id));
                }
              }

              return {
                createdUser,
                createdSession,
              };
            },
          );

          setSessionCookie(c, createdSession.id, expiresAt);

          return sendOk(c, {
            userId: createdUser.id,
            sessionToken: createdSession.id,
          });
        }

        const createdSession = await c.var.db.transaction(async (tx) => {
          const [createdSession] = await tx
            .insert(sessions)
            .values({
              expiresAt,
              userId: existingUser.id,
              ipAddress: ipAddress ?? "0.0.0.0",
              userAgent: userAgent,
            })
            .returning({
              id: sessions.id,
            })
            .execute();
          if (!createdSession) return tx.rollback();

          const now = new Date();

          const usersActiveSessions = await tx.$count(
            sessions,
            and(
              eq(sessions.userId, existingUser.id),
              eq(sessions.isRevoked, false),
              gte(sessions.expiresAt, now),
            ),
          );
          if (usersActiveSessions > env.MAX_USER_ACTIVE_SESSIONS) {
            const [oldestSession] = await tx
              .select({
                id: sessions.id,
              })
              .from(sessions)
              .where(
                and(
                  eq(sessions.userId, existingUser.id),
                  eq(sessions.isRevoked, false),
                  gte(sessions.expiresAt, now),
                ),
              )
              .orderBy(asc(sessions.lastActiveAt))
              .limit(1);
            if (oldestSession) {
              await tx
                .update(sessions)
                .set({
                  isRevoked: true,
                })
                .where(eq(sessions.id, oldestSession.id));
            }
          }

          return createdSession;
        });

        setSessionCookie(c, createdSession.id, expiresAt);

        return sendOk(c, {
          userId: existingUser.id,
          sessionToken: createdSession.id,
        });
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnexpected(c);
      }
    },
  )
  .post(
    "/signout",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    async (c) => {
      const sessionId = c.get("sessionId");
      if (!sessionId) {
        deleteSessionCookie(c);

        return sendUnauthorized(
          c,
          SESSION_TOKEN_NOT_PROVIDED,
          "No session token provided",
        );
      }

      try {
        await c.var.db
          .update(sessions)
          .set({
            isRevoked: true,
          })
          .where(eq(sessions.id, sessionId));

        deleteSessionCookie(c);

        return sendNoContent(c);
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnexpected(c);
      }
    },
  );

export default authHandlers;
