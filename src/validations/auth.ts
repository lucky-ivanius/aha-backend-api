import { z } from "zod";

export const bearerAuthHeaderSchema = z.object({
  authorization: z
    .string({
      required_error: "Authorization header is required",
      invalid_type_error: "Authorization header must be a string",
    })
    .startsWith("Bearer ", {
      message: "Invalid authorization header",
    })
    .transform((header) => header.slice(7)),
});
