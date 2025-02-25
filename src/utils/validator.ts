import { Context, Env, Input } from "hono";
import { ZodSchema, TypeOf } from "zod";
import { sendBadRequest, errors } from "./response";

export const zodSchemaValidator =
  <Schema extends ZodSchema>(schema: Schema) =>
  <Value, E extends Env, P extends string, I extends Input>(
    value: Value,
    c: Context<E, P, I>,
  ): TypeOf<Schema> => {
    const result = schema.safeParse(value);

    if (!result.success)
      return sendBadRequest(
        c,
        errors.VALIDATION_ERROR,
        result.error.issues[0].message,
      );

    return result.data;
  };
