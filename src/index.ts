import { serve } from "@hono/node-server";

import logger from "./utils/logger";

import app from "./app";
import env from "./config/env";

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  ({ address, port }) => {
    logger.info(`Server is running`, { address, port });
  },
);
