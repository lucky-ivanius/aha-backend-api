import { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

import env from "../config/env";

const SESSION_COOKIE_NAME = "sid";

export const getSessionCookie = (c: Context) => {
  return getCookie(c, SESSION_COOKIE_NAME);
};

export const setSessionCookie = (
  c: Context,
  sessionId: string,
  expiresAt: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
) => {
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    sameSite: "lax",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
  });
};

export const deleteSessionCookie = (c: Context) => {
  return deleteCookie(c, SESSION_COOKIE_NAME);
};
