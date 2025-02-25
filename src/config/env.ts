import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().min(0).max(65535).default(3000),
});

const env = envSchema.parse(process.env);

export default env;
