import { and, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";

import {
  SESSION_NOT_FOUND,
  UNABLE_TO_REVOKE_CURRENT_SESSION,
} from "../config/consts";

import schema from "../lib/db/schema/drizzle";

import { sessionCookieMiddleware } from "../middlewares/auth";
import { protectedRouteRateLimitMiddleware } from "../middlewares/rate-limiter";

import { attachRequestId } from "../utils/logger";
import {
  sendBadRequest,
  sendNoContent,
  sendNotFound,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "../utils/response";

const { sessions } = schema;

const sessionHandlers = new Hono();

sessionHandlers
  .get(
    "/",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return sendUnauthorized(c);

      try {
        const activeSessions = await c.var.db
          .select({
            id: sessions.id,
            ipAddress: sessions.ipAddress,
            userAgent: sessions.userAgent,
            lastActiveAt: sessions.lastActiveAt,
            loginDate: sessions.createdAt,
            expiresAt: sessions.expiresAt,
            isCurrentSession: eq(sessions.id, c.get("sessionId") ?? ""),
          })
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, userId),
              eq(sessions.isRevoked, false),
              gte(sessions.expiresAt, new Date()),
            ),
          )
          .orderBy(desc(sessions.id));

        return sendOk(
          c,
          activeSessions.map((session) => ({
            ...session,
            lastActiveAt: +session.lastActiveAt,
            loginDate: +session.loginDate,
            expiresAt: +session.expiresAt,
          })),
        );
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnexpected(c);
      }
    },
  )
  .delete(
    "/:sessionId",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return sendUnauthorized(c);

      const sessionId = c.req.param("sessionId");

      const currentSessionId = c.get("sessionId");
      if (sessionId === currentSessionId)
        return sendBadRequest(
          c,
          UNABLE_TO_REVOKE_CURRENT_SESSION,
          "Unable to revoke current session, use /auth/signout instead",
        );

      try {
        const [session] = await c.var.db
          .update(sessions)
          .set({
            isRevoked: true,
          })
          .returning({
            id: sessions.id,
          })
          .where(
            and(
              eq(sessions.id, sessionId),
              eq(sessions.userId, userId),
              eq(sessions.isRevoked, false),
              gte(sessions.expiresAt, new Date()),
            ),
          );
        if (!session)
          return sendNotFound(
            c,
            SESSION_NOT_FOUND,
            `Session with id: ${sessionId} was not found`,
          );

        return sendNoContent(c);
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnauthorized(c);
      }
    },
  );

export default sessionHandlers;
