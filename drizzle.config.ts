import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/drizzle/**/*.schema.ts",
  out: "./src/lib/db/migration/drizzle",
  dbCredentials: {
    url: process.env.PG_DATABASE_URL!,
  },
  casing: "snake_case",
});
