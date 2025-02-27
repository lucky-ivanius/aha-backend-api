import { Env, Input } from "hono";
import { createMiddleware } from "hono/factory";

import { attachRequestId } from "../utils/logger";

const colorStatus = (status: number) => {
  switch ((status / 100) | 0) {
    case 5: // red = error
      return `\x1b[31m${status}\x1b[0m`;
    case 4: // yellow = warning
      return `\x1b[33m${status}\x1b[0m`;
    case 3: // cyan = redirect
      return `\x1b[36m${status}\x1b[0m`;
    case 2: // green = success
      return `\x1b[32m${status}\x1b[0m`;
  }
  return `${status}`;
};

export const loggerMiddleware = <
  E extends Env,
  P extends string,
  I extends Input,
>() =>
  createMiddleware<E, P, I>(async (c, next) => {
    const start = Date.now();

    attachRequestId(c.get("requestId")).info(
      `--> ${c.req.method} ${c.req.path}`,
    );

    await next();

    attachRequestId(c.get("requestId")).info(
      `<-- ${c.req.method} ${c.req.path} - ${colorStatus(c.res.status)} ${Date.now() - start}ms`,
    );
  });
