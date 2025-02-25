import jwt from "jsonwebtoken";

import env from "../../config/env";

export const signJwt = <T extends string | Buffer | object>(payload: T) => {
  return jwt.sign(payload, env.JWT_SECRET_KEY);
};

export const verifyJwt = <T extends string | Buffer | object>(
  token: string,
  secretKey: jwt.Secret,
) => {
  return jwt.verify(token, secretKey) as T;
};
