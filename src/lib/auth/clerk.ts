import jwt from "jsonwebtoken";
import { createClerkClient } from "@clerk/backend";

import env from "../../config/env";

export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

export const verifyClerkToken = async (token: string) => {
  try {
    const { sub, exp, nbf, azp } = jwt.verify(
      token,
      env.CLERK_JWKS_PUBLIC_KEY,
      {
        algorithms: ["RS256"],
      },
    ) as jwt.JwtPayload & { azp?: string };

    const currentTime = Math.floor(Date.now() / 1000);
    if (exp && nbf && (exp < currentTime || nbf > currentTime)) return null;

    if (azp && !env.CLERK_AUTHORIZED_PARTIES.includes(azp)) return null;

    return sub ?? null;
  } catch (_error) {
    return null;
  }
};

export const getClerkUser = async (userId: string) => {
  try {
    const user = await clerkClient.users.getUser(userId);

    return user;
  } catch (_error) {
    return null;
  }
};
