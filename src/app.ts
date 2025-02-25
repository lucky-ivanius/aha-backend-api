import { Hono } from "hono";

import clerkAuthHandlers from "./handlers/auth/clerk";

const app = new Hono();

app.basePath("/api").route("/auth", clerkAuthHandlers);

export default app;
