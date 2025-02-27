import { and, eq } from "drizzle-orm";
import { Env, Input } from "hono";
import { createMiddleware } from "hono/factory";

import schema from "../lib/db/schema/drizzle";

import { sendUnauthorized, sendUnexpected } from "../utils/response";
import { deleteSessionCookie, getSessionCookie } from "../utils/sessions";
import { attachRequestId } from "../utils/logger";
import {
  INVALID_SESSION_TOKEN,
  SESSION_TOKEN_EXPIRED,
  SESSION_TOKEN_NOT_PROVIDED,
} from "../config/consts";

declare module "hono" {
  interface ContextVariableMap {
    userId?: string;
    sessionId?: string;
  }
}

const { sessions } = schema;

export const sessionCookieMiddleware = <
  E extends Env,
  P extends string,
  I extends Input,
>() =>
  createMiddleware<E, P, I>(async (c, next) => {
    const sessionId = getSessionCookie(c);
    if (!sessionId)
      return sendUnauthorized(
        c,
        SESSION_TOKEN_NOT_PROVIDED,
        "No session token provided",
      );

    try {
      const [session] = await c.var.db
        .select({
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.isRevoked, false)));

      if (!session) {
        deleteSessionCookie(c);

        return sendUnauthorized(
          c,
          INVALID_SESSION_TOKEN,
          "Invalid session token",
        );
      }

      if (session.expiresAt < new Date()) {
        deleteSessionCookie(c);

        return sendUnauthorized(
          c,
          SESSION_TOKEN_EXPIRED,
          "Session token expired",
        );
      }

      await c.var.db
        .update(sessions)
        .set({
          lastActiveAt: new Date(),
        })
        .where(and(eq(sessions.id, sessionId), eq(sessions.isRevoked, false)));

      c.set("userId", session.userId);
      c.set("sessionId", sessionId);

      await next();
    } catch (error) {
      attachRequestId(c.get("requestId")).error((error as Error).message);
      return sendUnexpected(c);
    }
  });
