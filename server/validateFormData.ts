import { JsonSchema, jsonType, validateJson } from "./validateJson.ts";

/**
 * Validates form data against a form data schema.
 *
 * @internal
 */
export async function validateFormData<T extends FormDataSchema>(
  schema: T,
  value: FormData,
): Promise<formDataType<T>> {
  const result: Record<string, unknown> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fieldValue = value.get(fieldName);

    if (fieldValue == null) {
      throw new Error(`Missing field ${fieldName}`);
    }

    switch (fieldSchema.kind) {
      case "value": {
        if (!(typeof fieldValue == "string")) {
          throw new Error(`Expected field ${fieldName} to be a simple value`);
        }
        switch (fieldSchema.type) {
          case "string": {
            result[fieldName] = fieldValue;
            break;
          }
          case "number": {
            const value = parseFloat(fieldValue);
            if (isNaN(value)) {
              throw new Error(`Expected field ${fieldName} to be a number`);
            }
            result[fieldName] = value;
            break;
          }
          case "integer": {
            const number = parseInt(fieldValue, 10);
            if (isNaN(number)) {
              throw new Error(`Expected field ${fieldName} to be an integer`);
            }
            result[fieldName] = number;
            break;
          }
          default: {
            throw new Error(`Unknown form data type ${fieldSchema["type"]}`);
          }
        }
        break;
      }

      case "file": {
        if (!(fieldValue instanceof File)) {
          throw new Error(`Expected field ${fieldName} to be a file`);
        }
        switch (fieldSchema.type) {
          case "application/json": {
            try {
              result[fieldName] = validateJson(
                fieldSchema.schema,
                JSON.parse(await fieldValue.text()),
              );
            } catch (error) {
              throw new Error(
                `Invalid JSON in field ${fieldName}: ${error.message}`,
              );
            }
            break;
          }
          case "application/octet-stream": {
            result[fieldName] = fieldValue;
            break;
          }
          default: {
            throw new Error(`Unknown form data type ${fieldSchema["type"]}`);
          }
        }
        break;
      }

      default: {
        throw new Error(`Unknown form data kind ${fieldSchema["kind"]}`);
      }
    }
  }
  return result as formDataType<T>;
}

/**
 * Form data schema.
 */
export type FormDataSchema = {
  [key: string]:
    | { kind: "value"; type: "string" | "number" | "integer" }
    | { kind: "file"; type: "application/json"; schema: JsonSchema }
    | { kind: "file"; type: "application/octet-stream" };
};

/**
 * Returns the type of form data based on its schema.
 *
 * @template T The {@link FormDataSchema}.
 */
export type formDataType<T extends FormDataSchema> = {
  -readonly [K in keyof T]: T[K] extends { kind: "value"; type: "string" }
    ? string
    : T[K] extends { kind: "value"; type: "number" } ? number
    : T[K] extends { kind: "value"; type: "integer" } ? number
    : T[K] extends {
      kind: "file";
      type: "application/json";
      schema: infer S extends JsonSchema;
    } ? jsonType<S>
    : T[K] extends { kind: "file"; type: "application/octet-stream" } ? Blob
    : never;
};
