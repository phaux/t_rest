import {
  FormDataSchema,
  formDataType,
  validateFormData,
} from "./validateFormData.ts";
import { JsonSchema, jsonType, validateJson } from "./validateJson.ts";

/**
 * Used by endpoints to validate the body of a request.
 *
 * @internal
 */
export async function validateBody<BS extends BodySchema>(
  schema: BS,
  request: Request,
): Promise<bodyType<BS>> {
  switch (schema.type) {
    case "text/plain": {
      return {
        type: "text/plain",
        data: await request.text(),
      } as bodyType<BS>;
    }
    case "application/json": {
      try {
        return {
          type: "application/json",
          data: validateJson(schema.schema, await request.json()),
        } as bodyType<BS>;
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
        } as bodyType<BS>;
      } catch (error) {
        throw new Error(`Invalid form data: ${error.message}`);
      }
    }
    default: {
      if (
        schema.type === "application/octet-stream" ||
        schema.type.startsWith("image/") ||
        schema.type.startsWith("audio/") ||
        schema.type.startsWith("video/")
      ) {
        return {
          type: schema.type,
          data: await request.blob(),
        } as bodyType<BS>;
      }

      throw new Error(
        `Unknown body type ${schema["type"]}`,
      );
    }
  }
}

/**
 * Request body schema used by endpoint.
 */
export type BodySchema =
  | { type: "text/plain" }
  | { type: "application/json"; schema: JsonSchema }
  | { type: "multipart/form-data"; schema: FormDataSchema }
  | { type: "application/octet-stream" }
  | { type: `image/${string}` }
  | { type: `audio/${string}` }
  | { type: `video/${string}` };

/**
 * Returns the type of a request body based on its schema.
 *
 * @template BS The {@link BodySchema}.
 */
export type bodyType<BS extends BodySchema> = BS extends { type: "text/plain" }
  ? { type: "text/plain"; data: string }
  : BS extends { type: "application/json"; schema: infer S extends JsonSchema }
    ? { type: "application/json"; data: jsonType<S> }
  : BS extends
    { type: "multipart/form-data"; schema: infer S extends FormDataSchema }
    ? { type: "multipart/form-data"; data: formDataType<S> }
  : BS extends { type: "application/octet-stream" }
    ? { type: "application/octet-stream"; data: Blob }
  : BS extends { type: `image/${infer M extends string}` }
    ? { type: `image/${M}`; data: Blob }
  : BS extends { type: `audio/${infer M extends string}` }
    ? { type: `audio/${M}`; data: Blob }
  : BS extends { type: `video/${infer M extends string}` }
    ? { type: `video/${M}`; data: Blob }
  : never;
