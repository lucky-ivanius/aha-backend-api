import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  TZ: z.string().transform((value) => {
    const isValidTz = Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone.includes(value);

    return isValidTz ? value : "UTC";
  }),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "verbose", "debug", "silly"])
    .default("info"),
  PORT: z.coerce.number().min(0).max(65535).default(3000),
  ORIGINS: z
    .string()
    .default("")
    .transform((value) => value.split(",").map((item) => item.trim())),
  SESSION_EXPIRATION_TIME: z.coerce
    .number()
    .min(1000 * 60 * 5) // 5 minutes
    .max(1000 * 60 * 60 * 24 * 365) // 1 year
    .default(1000 * 60 * 60 * 24 * 7), // 1 week
  MAX_USER_ACTIVE_SESSIONS: z.coerce.number().min(1).default(10),
  PUBLIC_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1).default(10000),
  PUBLIC_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(50),
  PRIVATE_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1).default(2000),
  PRIVATE_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(20),
  // Database
  PG_DATABASE_URL: z.string().url(),
  // 3rd party services
  CLERK_SECRET_KEY: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_JWKS_PUBLIC_KEY: z.string(),
  CLERK_AUTHORIZED_PARTIES: z
    .string()
    .transform((value) => value.split(",").map((item) => item.trim())),
});

const env = envSchema.parse(process.env);

export default env;
