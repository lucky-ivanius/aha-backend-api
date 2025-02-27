import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import env from "../../config/env";

import logger from "../../utils/logger";
import schema from "./schema/drizzle";

const db = drizzle(env.PG_DATABASE_URL, {
  schema,
  casing: "snake_case",
});

const checkConnection = async () => {
  try {
    const [result] = (
      await db.execute<{ current_database: string }>(
        sql`SELECT current_database();`,
      )
    ).rows;

    logger.info("Established connection to database", {
      current_database: result.current_database,
    });
  } catch (error) {
    delete (error as Error).stack;

    logger.error(error);
    process.exit(1);
  }
};

checkConnection();

export default db;
