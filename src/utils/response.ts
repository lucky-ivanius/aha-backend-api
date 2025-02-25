import { Context } from "hono";
import {
  ClientErrorStatusCode,
  ServerErrorStatusCode,
} from "hono/utils/http-status";

export const errors = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST_ERROR: "BAD_REQUEST",
  UNAUTHORIZED_ERROR: "UNAUTHORIZED",
  FORBIDDEN_ERROR: "FORBIDDEN",
  NOT_FOUND_ERROR: "NOT_FOUND",
  TOO_MANY_REQUESTS_ERROR: "TOO_MANY_REQUESTS",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
};

export function sendOk<Data>(c: Context, data?: Data): Response {
  return c.json(data ?? null, 200, {
    "Content-Type": "application/json",
  });
}

export function sendCreated<Data = never>(c: Context, data?: Data): Response {
  return c.json(data ?? null, 201, {
    "Content-Type": "application/json",
  });
}

export function sendNoContent(c: Context): Response {
  return c.body(null, 204, { "Content-Type": "application/json" });
}

function errorResponse(
  c: Context,
  status: ClientErrorStatusCode | ServerErrorStatusCode,
  error: string,
  message?: string,
) {
  return c.json({ error, message }, status);
}

export function sendBadRequest(
  c: Context,
  error: string = errors.BAD_REQUEST_ERROR,
  message?: string,
): Response {
  return errorResponse(c, 400, error, message);
}

export function sendUnauthorized(
  c: Context,
  error: string = errors.UNAUTHORIZED_ERROR,
  message?: string,
): Response {
  return errorResponse(c, 401, error, message);
}

export function sendForbidden(
  c: Context,
  error: string = errors.FORBIDDEN_ERROR,
  message?: string,
): Response {
  return errorResponse(c, 403, error, message);
}

export function sendNotFound(
  c: Context,
  error: string = errors.NOT_FOUND_ERROR,
  message?: string,
): Response {
  return errorResponse(c, 404, error, message);
}

export function sendTooManyRequests(
  c: Context,
  error: string = errors.TOO_MANY_REQUESTS_ERROR,
  message?: string,
): Response {
  return errorResponse(c, 429, error, message);
}

export function sendUnexpected(c: Context): Response {
  return errorResponse(c, 500, errors.UNEXPECTED_ERROR);
}
