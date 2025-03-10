import jwt from "jsonwebtoken";
import { createClerkClient } from "@clerk/backend";

import { AuthProvider } from "../../interfaces/auth-provider";

import env from "../../config/env";

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

const verifyClerkToken = async (token: string) => {
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

    if (!sub) return null;

    return {
      userId: sub,
    };
  } catch (_error) {
    return null;
  }
};

const getClerkUser = async (userId: string) => {
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0];

    return {
      id: user.id,
      email: email.emailAddress,
      name: user.fullName ?? email.emailAddress,
      passwordEnabled: user.passwordEnabled,
      verified: email.verification?.status === "verified",
    };
  } catch (_error) {
    return null;
  }
};

const verifyClerkUserPassword = async (
  providerUserId: string,
  password: string,
) => {
  try {
    const { verified } = await clerkClient.users.verifyPassword({
      userId: providerUserId,
      password,
    });

    return verified;
  } catch (_error) {
    return false;
  }
};

const updateClerkUserPassword = async (
  providerUserId: string,
  password: string,
) => {
  await clerkClient.users.updateUser(providerUserId, {
    password,
  });
};

const clerkAuthProvider: AuthProvider<"clerk"> = {
  name: "clerk",
  allowPassword: true,

  getProviderUser: getClerkUser,

  verifyToken: verifyClerkToken,
  verifyPassword: verifyClerkUserPassword,

  updatePassword: updateClerkUserPassword,
};

export default clerkAuthProvider;
