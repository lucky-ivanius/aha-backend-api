import { Hono } from "hono";
import { cors } from "hono/cors";
import { trimTrailingSlash } from "hono/trailing-slash";
import { HTTPResponseError } from "hono/types";
import { prettyJSON } from "hono/pretty-json";

import db from "./lib/db/drizzle";
import clerkAuthProvider from "./lib/auth/clerk";

import {
  errors,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendUnauthorized,
  sendUnexpected,
} from "./utils/response";

import authHandlers from "./handlers/auth/auth.handler";
import userHandlers from "./handlers/users/user.handler";

const app = new Hono();

declare module "hono" {
  interface ContextVariableMap {
    db: typeof db;
  }
}

app
  .use(
    cors({
      origin: "*",
    }),
  )
  .use(prettyJSON())
  .use(trimTrailingSlash())
  .use(async (c, next) => {
    c.set("db", db);
    c.set("authProvider", clerkAuthProvider);

    return next();
  })
  .onError((err, c) => {
    const httpResponseError = (err as HTTPResponseError).getResponse?.();
    if (httpResponseError && !httpResponseError.ok)
      switch (httpResponseError.status) {
        case 400:
          return sendBadRequest(c, errors.BAD_REQUEST_ERROR, err.message);
        case 401:
          return sendUnauthorized(c, errors.UNAUTHORIZED_ERROR, err.message);
        case 403:
          return sendForbidden(c, errors.FORBIDDEN_ERROR, err.message);
        default:
          return sendUnexpected(c);
      }

    return sendUnexpected(c);
  })
  .basePath("/api")
  .route("/auth", authHandlers)
  .route("/users", userHandlers)
  .all("*", async (c) => {
    return sendNotFound(
      c,
      errors.NOT_FOUND_ERROR,
      `${c.req.method} ${c.req.path} was not found`,
    );
  });

export default app;
