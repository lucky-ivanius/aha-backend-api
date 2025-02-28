import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getConnInfo } from "@hono/node-server/conninfo";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";
import { HTTPResponseError } from "hono/types";

import clerkAuthProvider from "./lib/auth/clerk";
import db from "./lib/db/drizzle";

import { AHA_REQUEST_ID } from "./config/consts";
import env from "./config/env";

import openapi from "./docs/openapi.json";

import { attachRequestId } from "./utils/logger";
import {
  errors,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendOk,
  sendUnauthorized,
  sendUnexpected,
} from "./utils/response";

import { loggerMiddleware } from "./middlewares/logger";
import { rateLimitMiddleware } from "./middlewares/rate-limiter";

import authHandlers from "./handlers/auth";
import sessionHandlers from "./handlers/sessions";
import userHandlers from "./handlers/users";

const app = new Hono();

declare module "hono" {
  interface ContextVariableMap {
    db: typeof db;
  }
}

app
  .use(async (c, next) => {
    c.set("db", db);
    c.set("authProvider", clerkAuthProvider);

    return next();
  })
  .use(
    requestId({
      headerName: AHA_REQUEST_ID,
    }),
  )
  .use(
    cors({
      origin: env.ORIGINS.length ? env.ORIGINS : "*",
      credentials: true,
    }),
  )
  .use(secureHeaders())
  .use(prettyJSON())
  .use(trimTrailingSlash())
  .use(loggerMiddleware())
  .onError((err, c) => {
    const logger = attachRequestId(c.get("requestId"));
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
          logger.error(err);
          return sendUnexpected(c);
      }

    logger.error(err);
    return sendUnexpected(c);
  })
  .use(
    rateLimitMiddleware({
      windowMs: env.PUBLIC_RATE_LIMIT_WINDOW_MS,
      limit: env.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
      keyGenerator: (c) => {
        const key =
          c.req.header("x-forwarded-for") ??
          getConnInfo(c).remote.address ??
          "global";

        return key;
      },
    }),
  )
  .get(
    "/docs",
    swaggerUI({
      url: "/docs/openapi.json",
    }),
  )
  .get("/docs/openapi.json", async (c) => {
    return sendOk(c, openapi);
  })
  .basePath("/api")
  .route("/auth", authHandlers)
  .route("/users", userHandlers)
  .route("/sessions", sessionHandlers)
  .all("*", async (c) => {
    return sendNotFound(
      c,
      errors.NOT_FOUND_ERROR,
      `${c.req.method} ${c.req.path} was not found`,
    );
  });

export default app;
