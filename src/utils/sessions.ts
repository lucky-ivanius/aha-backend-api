import { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

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
    sameSite: "none",
    httpOnly: true,
    secure: true,
    expires: expiresAt,
  });
};

export const deleteSessionCookie = (c: Context) => {
  deleteCookie(c, SESSION_HEADER);
};
