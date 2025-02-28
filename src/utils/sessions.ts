import { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

import env from "../config/env";
import { SESSION_HEADER } from "../config/consts";

export const getSessionCookie = (c: Context) => {
  return getCookie(c, SESSION_HEADER);
};

export const setSessionCookie = (
  c: Context,
  sessionId: string,
  expiresAt: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
) => {
  setCookie(c, SESSION_HEADER, sessionId, {
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
  });
};

export const deleteSessionCookie = (c: Context) => {
  deleteCookie(c, SESSION_HEADER);
};
