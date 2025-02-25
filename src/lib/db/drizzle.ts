import { drizzle } from "drizzle-orm/node-postgres";

import env from "../../config/env";

import schema from "./schema/drizzle";

const db = drizzle(env.PG_DATABASE_URL, { schema, casing: "snake_case" });

export default db;
