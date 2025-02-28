import { Context } from "hono";

// import { getConnInfo as getNodeConnInfo } from "@hono/node-server/conninfo";
import { getConnInfo as getVercelConnInfo } from "hono/vercel";

export const getIpAddress = (c: Context) => {
  return getVercelConnInfo(c).remote.address;
  // : getNodeConnInfo(c).remote.address;
};
