import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().min(0).max(65535).default(3000),
  JWT_SECRET_KEY: z.string(),
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
