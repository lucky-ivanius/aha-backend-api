import { and, count, desc, eq, gte, max } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import schema from "../../lib/db/schema/drizzle";

import { sessionCookieMiddleware } from "../../middlewares/auth.middleware";

import { attachRequestId } from "../../utils/logger";
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
  .get("/", sessionCookieMiddleware(), async (c) => {
    try {
      const userList = await c.var.db
        .select({
          id: users.id,
          name: users.name,
          signUpDate: users.createdAt,
          loggedInTotal: count(sessions.id),
          lastLoginDate: max(sessions.lastActiveAt),
        })
        .from(users)
        .leftJoin(sessions, eq(sessions.userId, users.id))
        .groupBy(users.id)
        .orderBy(desc(users.createdAt));

      return sendOk(c, userList);
    } catch (error) {
      attachRequestId(c.get("requestId")).error((error as Error).message);
      return sendUnexpected(c);
    }
  })
  .get("/stats", sessionCookieMiddleware(), async (c) => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    try {
      const { userSignUp, todaysActiveSession, average7dActiveUsers } =
        await c.var.db.transaction(async (tx) => {
          const [userSignUp] = await tx
            .select({
              total: count(users.id),
            })
            .from(users);

          const [todaysActiveSession] = await tx
            .select({
              total: count(sessions.id),
            })
            .from(sessions)
            .where(
              and(
                eq(sessions.isRevoked, false),
                gte(sessions.expiresAt, now),
                gte(sessions.createdAt, startOfToday),
              ),
            );

          const sevenDaysAgo = new Date(
            now.getTime() - 7 * 24 * 60 * 60 * 1000,
          );

          const [average7dActiveUsers] = await tx
            .select({
              average: count(sessions.id),
            })
            .from(sessions)
            .where(
              and(
                eq(sessions.isRevoked, false),
                gte(sessions.expiresAt, now),
                gte(sessions.createdAt, sevenDaysAgo),
              ),
            );

          return {
            userSignUp: userSignUp.total,
            todaysActiveSession: todaysActiveSession.total,
            average7dActiveUsers: +(average7dActiveUsers.average / 7).toFixed(
              2,
            ),
          };
        });

      return sendOk(c, {
        userSignUp,
        todaysActiveSession,
        average7dActiveUsers,
      });
    } catch (error) {
      attachRequestId(c.get("requestId")).error((error as Error).message);
      return sendUnexpected(c);
    }
  })
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
    } catch (error) {
      attachRequestId(c.get("requestId")).error((error as Error).message);
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
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnexpected(c);
      }
    },
  )
  .get("/password-setup", sessionCookieMiddleware(), async (c) => {
    const userId = c.get("userId");
    if (!userId) return sendUnauthorized(c);

    const { name, allowPassword } = c.var.authProvider;

    if (!allowPassword)
      return sendOk(c, {
        allowPassword,
        passwordEnabled: false,
      });

    try {
      const [userProvider] = await c.var.db
        .select({
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

      return sendOk(c, {
        allowPassword,
        passwordEnabled: userProvider.passwordEnabled,
      });
    } catch (error) {
      attachRequestId(c.get("requestId")).error((error as Error).message);
      return sendUnexpected(c);
    }
  })
  .post(
    "/set-password",
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
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnexpected(c);
      }
    },
  )
  .post(
    "/change-password",
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
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
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
    } catch (error) {
      attachRequestId(c.get("requestId")).error((error as Error).message);
      return sendUnexpected(c);
    }
  });

export default userHandlers;
