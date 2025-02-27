import { getConnInfo } from "@hono/node-server/conninfo";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import schema from "../lib/db/schema/drizzle";

import { attachRequestId } from "../utils/logger";
import {
  errors,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "../utils/response";
import { setSessionCookie } from "../utils/sessions";
import { zodSchemaValidator } from "../utils/validator";

import { AuthProvider } from "../interfaces/auth-provider";
import { bearerAuthHeaderSchema } from "../validations/auth";

declare module "hono" {
  interface ContextVariableMap {
    authProvider: AuthProvider;
  }
}

const { users, sessions, userProviders } = schema;

const authHandlers = new Hono();

authHandlers.post(
  "/signin",
  validator("header", zodSchemaValidator(bearerAuthHeaderSchema)),
  async (c) => {
    const { authorization: token } = c.req.valid("header");
    const userAgent = c.req.header("User-Agent");
    const connInfo = getConnInfo(c);

    try {
      const payload = await c.var.authProvider.verifyToken(token);
      if (!payload)
        return sendUnauthorized(c, errors.UNAUTHORIZED_ERROR, "Invalid token");

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

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      if (!existingUser) {
        const providerUser =
          await c.var.authProvider.getProviderUser(externalUserId);
        if (!providerUser)
          return sendUnauthorized(
            c,
            errors.UNAUTHORIZED_ERROR,
            "Invalid token",
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
                ipAddress: connInfo.remote.address ?? "0.0.0.0",
                userAgent: userAgent,
              })
              .returning({
                id: sessions.id,
              })
              .execute();
            if (!createdSession) return tx.rollback();

            return {
              createdUser,
              createdSession,
            };
          },
        );

        setSessionCookie(c, createdSession.id);

        return sendOk(c, {
          userId: createdUser.id,
          sessionToken: createdSession.id,
        });
      }

      const [session] = await c.var.db
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

      setSessionCookie(c, session.id);

      return sendOk(c, { userId: existingUser.id, sessionToken: session.id });
    } catch (error) {
      attachRequestId(c.get("requestId")).error((error as Error).message);
      return sendUnexpected(c);
    }
  },
);

export default authHandlers;
