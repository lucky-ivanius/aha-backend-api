import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import schema from "../../lib/db/schema/drizzle";

import { sessionCookieMiddleware } from "../../middlewares/auth.middleware";
import {
  errors,
  sendBadRequest,
  sendForbidden,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "../../utils/response";
import { deleteSessionCookie } from "../../utils/sessions";
import { zodSchemaValidator } from "../../utils/validator";

import {
  changePasswordSchema,
  setPasswordSchema,
  updateUserSchema,
} from "../../validations/users";

const { users, sessions, userProviders } = schema;

const userHandlers = new Hono();

userHandlers
  .get("/me", sessionCookieMiddleware(), async (c) => {
    const userId = c.get("userId");
    if (!userId) return sendUnauthorized(c);

    try {
      const [user] = await c.var.db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, userId));

      return sendOk(c, user);
    } catch (_error) {
      return sendUnexpected(c);
    }
  })
  .patch(
    "/me",
    sessionCookieMiddleware(),
    validator("json", zodSchemaValidator(updateUserSchema)),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return sendUnauthorized(c);

      const { name } = c.req.valid("json");

      try {
        await c.var.db
          .update(users)
          .set({
            name,
          })
          .where(eq(users.id, userId));

        return sendOk(c);
      } catch (_error) {
        return sendUnexpected(c);
      }
    },
  )
  .get("/me/password-setup", sessionCookieMiddleware(), async (c) => {
    const userId = c.get("userId");
    if (!userId) return sendUnauthorized(c);

    const { name, allowPassword } = c.var.authProvider;

    if (!allowPassword)
      return sendOk(c, {
        allowPassword,
        passwordEnabled: false,
      });

    const [userProvider] = await c.var.db
      .select({
        passwordEnabled: userProviders.passwordEnabled,
      })
      .from(userProviders)
      .where(
        and(eq(userProviders.userId, userId), eq(userProviders.provider, name)),
      );
    if (!userProvider) return sendUnauthorized(c);

    return sendOk(c, {
      allowPassword,
      passwordEnabled: userProvider.passwordEnabled,
    });
  })
  .post(
    "/me/set-password",
    sessionCookieMiddleware(),
    validator("json", zodSchemaValidator(setPasswordSchema)),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return sendUnauthorized(c);

      const { name, allowPassword } = c.var.authProvider;

      if (!allowPassword)
        return sendForbidden(
          c,
          errors.FORBIDDEN_ERROR,
          "Password update is not allowed",
        );

      const { password } = c.req.valid("json");

      try {
        const [userProvider] = await c.var.db
          .select({
            externalId: userProviders.externalId,
            passwordEnabled: userProviders.passwordEnabled,
          })
          .from(userProviders)
          .where(
            and(
              eq(userProviders.userId, userId),
              eq(userProviders.provider, name),
            ),
          );
        if (!userProvider) return sendUnauthorized(c);

        if (userProvider.passwordEnabled)
          return sendBadRequest(
            c,
            errors.BAD_REQUEST_ERROR,
            "Password has already been set",
          );

        await c.var.authProvider.updatePassword(
          userProvider.externalId,
          password,
        );

        return sendOk(c);
      } catch (_error) {
        return sendUnexpected(c);
      }
    },
  )
  .post(
    "/me/change-password",
    sessionCookieMiddleware(),
    validator("json", zodSchemaValidator(changePasswordSchema)),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return sendUnauthorized(c);

      const { name, allowPassword } = c.var.authProvider;

      if (!allowPassword)
        return sendForbidden(
          c,
          errors.FORBIDDEN_ERROR,
          "Password update is not allowed",
        );

      const { currentPassword, newPassword } = c.req.valid("json");

      try {
        const [userProvider] = await c.var.db
          .select({
            externalId: userProviders.externalId,
            passwordEnabled: userProviders.passwordEnabled,
          })
          .from(userProviders)
          .where(
            and(
              eq(userProviders.userId, userId),
              eq(userProviders.provider, name),
            ),
          );
        if (!userProvider) return sendUnauthorized(c);

        const isValidPassword = userProvider.passwordEnabled
          ? await c.var.authProvider.verifyPassword(
              userProvider.externalId,
              currentPassword,
            )
          : true;
        if (!isValidPassword)
          return sendBadRequest(
            c,
            errors.BAD_REQUEST_ERROR,
            "Current password is invalid",
          );

        await c.var.authProvider.updatePassword(
          userProvider.externalId,
          newPassword,
        );

        return sendOk(c);
      } catch (_error) {
        return sendUnexpected(c);
      }
    },
  )
  .post("/logout", sessionCookieMiddleware(), async (c) => {
    const sessionId = c.get("sessionId");
    if (!sessionId) return sendUnauthorized(c);

    try {
      await c.var.db
        .update(sessions)
        .set({
          isRevoked: true,
        })
        .where(eq(sessions.id, sessionId));

      deleteSessionCookie(c);

      return sendOk(c);
    } catch (_error) {
      return sendUnexpected(c);
    }
  });

export default userHandlers;
