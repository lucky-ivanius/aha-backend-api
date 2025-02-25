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

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\\[\]{};':"\\|,.<>\\/?]).{8,}$/;

const password = (name: string) =>
  z
    .string({
      required_error: `${name} is required`,
      invalid_type_error: `${name} must be a string`,
    })
    .min(8, {
      message: `${name} must be at least 8 characters`,
    })
    .regex(passwordRegex, {
      message: `${name} must contain at least one uppercase letter, one lowercase letter, one number, and one special character`,
    });

export const setPasswordSchema = z.object({
  password: password("Password"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({
    required_error: "Current password is required",
    invalid_type_error: "Current password must be a string",
  }),
  newPassword: password("New password"),
});
