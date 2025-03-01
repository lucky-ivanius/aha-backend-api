import { and, count, desc, eq, gte, max } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import {
  INVALID_CURRENT_PASSWORD,
  PASSWORD_HAS_ALREADY_BEEN_SET,
  PASSWORD_UPDATE_NOT_ALLOWED,
} from "../config/consts";

import schema from "../lib/db/schema/drizzle";

import { sessionCookieMiddleware } from "../middlewares/auth";
import { protectedRouteRateLimitMiddleware } from "../middlewares/rate-limiter";

import { attachRequestId } from "../utils/logger";
import {
  sendBadRequest,
  sendForbidden,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "../utils/response";
import { zodSchemaValidator } from "../utils/validator";

import {
  changePasswordSchema,
  getUsersQuerySchema,
  setPasswordSchema,
  updateUserSchema,
} from "../validations/users";

const { users, sessions, userProviders } = schema;

const userHandlers = new Hono();

userHandlers
  .get(
    "/",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    validator("query", zodSchemaValidator(getUsersQuerySchema)),
    async (c) => {
      const { page, limit } = c.req.valid("query");

      try {
        const { userList, usersCount } = await c.var.db.transaction(
          async (tx) => {
            const userList = await tx
              .select({
                id: users.id,
                name: users.name,
                registrationDate: users.createdAt,
                totalLoginCount: count(sessions.id),
                lastActiveTimestamp: max(sessions.lastActiveAt),
              })
              .from(users)
              .leftJoin(sessions, eq(sessions.userId, users.id))
              .offset((page - 1) * limit)
              .limit(limit)
              .groupBy(users.id)
              .orderBy(desc(users.createdAt));

            const [{ total: usersCount }] = await tx
              .select({
                total: count(users.id),
              })
              .from(users);

            return {
              userList,
              usersCount,
            };
          },
        );

        return sendOk(c, {
          data: userList.map((user) => ({
            ...user,
            lastActiveTimestamp: user.lastActiveTimestamp
              ? +user.lastActiveTimestamp
              : null,
            registrationDate: +user.registrationDate,
          })),
          total: usersCount,
        });
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnexpected(c);
      }
    },
  )
  .get(
    "/me",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    async (c) => {
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
    },
  )
  .patch(
    "/me",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
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
  .get(
    "/stats",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    async (c) => {
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
          userSignUp: userSignUp ?? 0,
          todaysActiveSession: todaysActiveSession ?? 0,
          average7dActiveUsers: average7dActiveUsers ?? 0,
        });
      } catch (error) {
        attachRequestId(c.get("requestId")).error((error as Error).message);
        return sendUnexpected(c);
      }
    },
  )
  // Password
  .get(
    "/password",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    async (c) => {
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
    },
  )
  .post(
    "/password",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    validator("json", zodSchemaValidator(setPasswordSchema)),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return sendUnauthorized(c);

      const { name, allowPassword } = c.var.authProvider;

      if (!allowPassword)
        return sendForbidden(
          c,
          PASSWORD_UPDATE_NOT_ALLOWED,
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
            PASSWORD_HAS_ALREADY_BEEN_SET,
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
  .put(
    "/password",
    sessionCookieMiddleware(),
    protectedRouteRateLimitMiddleware(),
    validator("json", zodSchemaValidator(changePasswordSchema)),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return sendUnauthorized(c);

      const { name, allowPassword } = c.var.authProvider;

      if (!allowPassword)
        return sendForbidden(
          c,
          PASSWORD_UPDATE_NOT_ALLOWED,
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
            INVALID_CURRENT_PASSWORD,
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
  );

export default userHandlers;
