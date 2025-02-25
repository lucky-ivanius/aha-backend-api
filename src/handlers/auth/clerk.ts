import { Hono } from "hono";
import { validator } from "hono/validator";
import { v7 } from "uuid";

import { getClerkUser, verifyClerkToken } from "../../lib/auth/clerk";
import { signJwt } from "../../lib/token/jwt";

import {
  errors,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "../../utils/response";
import { zodSchemaValidator } from "../../utils/validator";

import { bearerAuthHeaderSchema } from "../../validations/auth";

const clerkAuthHandlers = new Hono();

const users = [] as {
  id: string;
  email: string;
  providers: {
    [provider: string]: {
      userId: string;
    };
  };
}[];

clerkAuthHandlers.post(
  "/signin/clerk",
  validator("header", zodSchemaValidator(bearerAuthHeaderSchema)),
  async (c) => {
    const { authorization: token } = c.req.valid("header");

    try {
      const clerkUserId = await verifyClerkToken(token);
      if (!clerkUserId)
        return sendUnauthorized(c, errors.UNAUTHORIZED_ERROR, "Invalid token");

      const clerkUser = await getClerkUser(clerkUserId);
      if (!clerkUser)
        return sendUnauthorized(c, errors.UNAUTHORIZED_ERROR, "Invalid token");

      const existingUser = users.find(
        (user) => user.providers["clerk"]?.userId === clerkUserId,
      );
      if (!existingUser) {
        const user = {
          id: v7(),
          email: clerkUser.emailAddresses[0].emailAddress,
          providers: {
            clerk: {
              userId: clerkUserId,
            },
          },
        };

        users.push(user);

        const { providers: _providers, ...parsedUser } = user;

        const accessToken = signJwt({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        });

        return sendOk(c, { user: parsedUser, accessToken });
      }

      const { providers: _providers, ...parsedUser } = existingUser;

      const accessToken = signJwt({
        sub: existingUser.id,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      });

      return sendOk(c, { user: parsedUser, accessToken });
    } catch (_error) {
      return sendUnexpected(c);
    }
  },
);

export default clerkAuthHandlers;
