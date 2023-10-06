import { JsonSchema, jsonType, validateJson } from "./validateJson.ts";
import {
  FormDataSchema,
  formDataType,
  validateFormData,
} from "./validateFormData.ts";

/**
 * Used by {@link Endpoint} to validate the body of a request.
 *
 * @internal
 */
export async function validateBody<T extends BodySchema>(
  schema: T,
  request: Request,
): Promise<bodyType<T>> {
  switch (schema.type) {
    case "text/plain": {
      return {
        type: "text/plain",
        data: await request.text(),
      } as bodyType<T>;
    }
    case "application/json": {
      try {
        return {
          type: "application/json",
          data: validateJson(schema.schema, await request.json()),
        } as bodyType<T>;
      } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
    }
    case "multipart/form-data": {
      try {
        return {
          type: "multipart/form-data",
          data: await validateFormData(
            schema.schema,
            await request.formData(),
          ),
        } as bodyType<T>;
      } catch (error) {
        throw new Error(`Invalid form data: ${error.message}`);
      }
    }
    default: {
      throw new Error(
        `Unknown body type ${schema["type"]}`,
      );
    }
  }
}

/**
 * Request body schema used by {@link Endpoint}.
 */
export type BodySchema =
  | { type: "text/plain" }
  | { type: "application/json"; schema: JsonSchema }
  | { type: "multipart/form-data"; schema: FormDataSchema };

/**
 * Returns the type of a request body based on its schema.
 *
 * @template T The {@link BodySchema}.
 */
export type bodyType<T extends BodySchema> = T extends { type: "text/plain" }
  ? { type: "text/plain"; data: string }
  : T extends { type: "application/json"; schema: infer S extends JsonSchema }
    ? { type: "application/json"; data: jsonType<S> }
  : T extends
    { type: "multipart/form-data"; schema: infer S extends FormDataSchema }
    ? { type: "multipart/form-data"; data: formDataType<S> }
  : never;
