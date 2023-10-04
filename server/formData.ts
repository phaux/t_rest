import { JsonSchema, jsonType, validateJson } from "./json.ts";

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

  for (const key in schema) {
    const paramSchema = schema[key];
    const paramValue = value.get(key);

    if (paramValue == null) {
      throw new Error(`Missing field ${key}`);
    }

    switch (paramSchema.kind) {
      case "value": {
        if (!(typeof paramValue == "string")) {
          throw new Error(`Expected field ${key} to be a simple value`);
        }
        switch (paramSchema.type) {
          case "string": {
            result[key] = paramValue;
            break;
          }
          case "number": {
            const value = parseFloat(paramValue);
            if (isNaN(value)) {
              throw new Error(`Expected field ${key} to be a number`);
            }
            result[key] = value;
            break;
          }
          case "integer": {
            const number = parseInt(paramValue, 10);
            if (isNaN(number)) {
              throw new Error(`Expected field ${key} to be an integer`);
            }
            result[key] = number;
            break;
          }
          default: {
            throw new Error(`Unknown form data type ${paramSchema["type"]}`);
          }
        }
        break;
      }

      case "file": {
        if (!(paramValue instanceof File)) {
          throw new Error(`Expected field ${key} to be a file`);
        }
        switch (paramSchema.type) {
          case "application/json": {
            try {
              result[key] = validateJson(
                paramSchema.schema,
                JSON.parse(await paramValue.text()),
              );
            } catch (error) {
              throw new Error(
                `Invalid JSON in field ${key}: ${error.message}`,
              );
            }
            break;
          }
          case "application/octet-stream": {
            result[key] = paramValue;
            break;
          }
          default: {
            throw new Error(`Unknown form data type ${paramSchema["type"]}`);
          }
        }
        break;
      }

      default: {
        throw new Error(`Unknown form data kind ${paramSchema["kind"]}`);
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
  [K in keyof T]: T[K] extends { kind: "value"; type: "string" } ? string
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
