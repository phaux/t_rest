import { JsonSchema, jsonType, validateJson } from "./json.ts";
import { FormDataSchema, formDataType, validateFormData } from "./formData.ts";

export async function validateBody<T extends BodySchema>(
  schema: T,
  request: Request,
): Promise<bodyType<T>> {
  switch (schema.type) {
    case "text/plain": {
      return (await request.text()) as bodyType<T>;
    }
    case "application/json": {
      try {
        return validateJson(schema.schema, await request.json()) as bodyType<T>;
      } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
    }
    case "multipart/form-data": {
      try {
        return (await validateFormData(
          schema.schema,
          await request.formData(),
        )) as bodyType<T>;
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

export type BodySchema =
  | { type: "text/plain" }
  | { type: "application/json"; schema: JsonSchema }
  | { type: "multipart/form-data"; schema: FormDataSchema };

export type bodyType<T extends BodySchema> = T extends { type: "text/plain" }
  ? string
  : T extends { type: "application/json"; schema: infer S extends JsonSchema }
    ? jsonType<S>
  : T extends
    { type: "multipart/form-data"; schema: infer S extends FormDataSchema }
    ? formDataType<S>
  : never;
