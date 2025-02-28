import { Context, Env, Input } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { createMiddleware } from "hono/factory";

import { errors, sendTooManyRequests } from "../utils/response";
import { getConnInfo } from "@hono/node-server/conninfo";
import env from "../config/env";

export const DEFAULT_RATE_LIMITER_MESSAGE =
  "Too many requests, please try again later.";

export interface RateLimitConfig<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input,
> {
  windowMs: number;
  limit: number;
  keyGenerator: (c: Context<E, P, I>) => string;
  message?: string;
}

export const rateLimitMiddleware = <
  E extends Env,
  P extends string,
  I extends Input,
>(
  config: RateLimitConfig<E, P, I>,
) =>
  createMiddleware<E, P, I>(
    rateLimiter({
      ...config,
      handler: (c) =>
        sendTooManyRequests(
          c,
          errors.TOO_MANY_REQUESTS_ERROR,
          config.message ?? DEFAULT_RATE_LIMITER_MESSAGE,
        ),
    }),
  );

export const protectedRouteRateLimitMiddleware = <
  E extends Env,
  P extends string,
  I extends Input,
>(
  config?: Partial<Omit<RateLimitConfig<E, P, I>, "keyGenerator">>,
) =>
  rateLimitMiddleware({
    windowMs: env.PRIVATE_RATE_LIMIT_WINDOW_MS,
    limit: env.PRIVATE_RATE_LIMIT_MAX_REQUESTS,
    keyGenerator: (c) =>
      c.get("userId") ||
      c.get("sessionId") ||
      `${getConnInfo(c).remote.address}|${c.req.method}|${c.req.path}`,
    ...config,
  });
