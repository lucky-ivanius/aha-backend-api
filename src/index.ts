import { serve } from "@hono/node-server";

import app from "./app";
import env from "./config/env";

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  ({ address, port }) => {
    // eslint-disable-next-line no-console
    console.info(`Server is running at http://${address}:${port}`);
  },
);
