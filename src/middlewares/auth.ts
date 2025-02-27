import { and, eq } from "drizzle-orm";
import { Env, Input } from "hono";
import { createMiddleware } from "hono/factory";

import schema from "../lib/db/schema/drizzle";

import { sendUnauthorized } from "../utils/response";
import { deleteSessionCookie, getSessionCookie } from "../utils/sessions";

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

    if (!sessionId) return sendUnauthorized(c);

    const userId = await c.var.db.transaction(async (tx) => {
      const [session] = await tx
        .select({
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.isRevoked, false)));
      if (!session || session.expiresAt < new Date()) {
        deleteSessionCookie(c);

        return null;
      }

      await tx
        .update(sessions)
        .set({
          lastActiveAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      return session.userId;
    });
    if (!userId) return sendUnauthorized(c);

    c.set("userId", userId);
    c.set("sessionId", sessionId);

    await next();
  });
