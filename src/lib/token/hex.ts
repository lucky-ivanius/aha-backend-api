import { randomBytes } from "crypto";

export const generateRandomHex = (bytes: number): string => {
  return randomBytes(bytes).toString("hex");
};
