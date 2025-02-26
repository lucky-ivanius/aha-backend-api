import { and, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";

import schema from "../../lib/db/schema/drizzle";

import { sessionCookieMiddleware } from "../../middlewares/auth.middleware";

import {
  errors,
  sendBadRequest,
  sendNoContent,
  sendNotFound,
  sendOk,
  sendUnauthorized,
} from "../../utils/response";

const { sessions } = schema;

const sessionHandlers = new Hono();

sessionHandlers
  .get("/", sessionCookieMiddleware(), async (c) => {
    const userId = c.get("userId");
    if (!userId) return sendUnauthorized(c);

    const activeSessions = await c.var.db
      .select({
        id: sessions.id,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        lastActiveAt: sessions.lastActiveAt,
        loginDate: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        isRevoked: sessions.isRevoked,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.isRevoked, false),
          gte(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.lastActiveAt));

    return sendOk(c, activeSessions);
  })
  .delete("/:sessionId", sessionCookieMiddleware(), async (c) => {
    const userId = c.get("userId");
    if (!userId) return sendUnauthorized(c);

    const sessionId = c.req.param("sessionId");
    if (!sessionId) return sendUnauthorized(c);

    const currentSessionId = c.get("sessionId");
    if (sessionId === currentSessionId)
      return sendBadRequest(
        c,
        errors.BAD_REQUEST_ERROR,
        "Unable to revoke current session, use /logout instead",
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
      if (!session) return sendNotFound(c);

      return sendNoContent(c);
    } catch (_error) {
      return sendUnauthorized(c);
    }
  });

export default sessionHandlers;
