import { z } from "zod";

export const updateUserSchema = z.object({
  name: z
    .string({
      invalid_type_error: "Name must be a string",
    })
    .min(3, {
      message: "Name must be at least 3 characters",
    })
    .max(64, {
      message: "Name must be at most 64 characters",
    })
    .trim()
    .optional(),
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
