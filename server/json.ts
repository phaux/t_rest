/**
 * Validates a JSON value against a JSON schema.
 *
 * @internal
 */
export function validateJson<T extends JsonSchema>(
  schema: T,
  value: unknown,
  path: Array<string | number> = [],
): jsonType<T> {
  switch (schema.type) {
    case "string": {
      if (typeof value != "string") {
        throw new Error(`Expected ${path.join(".")} to be a string`);
      }
      return value as jsonType<T>;
    }
    case "number": {
      if (typeof value != "number") {
        throw new Error(`Expected ${path.join(".")} to be a number`);
      }
      return value as jsonType<T>;
    }
    case "integer": {
      if (typeof value != "number" || !Number.isInteger(value)) {
        throw new Error(`Expected ${path.join(".")} to be an integer`);
      }
      return value as jsonType<T>;
    }
    case "boolean": {
      if (typeof value != "boolean") {
        throw new Error(`Expected ${path.join(".")} to be a boolean`);
      }
      return value as jsonType<T>;
    }
    case "array": {
      if (!Array.isArray(value)) {
        throw new Error(`Expected ${path.join(".")} to be an array`);
      }
      return value.map((item, index) =>
        validateJson(schema.items, item, [...path, index])
      ) as jsonType<T>;
    }
    case "object": {
      if (typeof value != "object" || value == null) {
        throw new Error(`Expected ${path.join(".")} to be an object`);
      }
      const result: Record<string, unknown> = {};
      for (const key in schema.properties) {
        const propertySchema = schema.properties[key];
        const propertyValue = (value as Record<string, unknown>)[key];
        if (propertyValue == null) {
          if (schema.required?.includes(key)) {
            throw new Error(
              `Missing required property ${[...path, key].join(".")}`,
            );
          }
          continue;
        }
        result[key] = validateJson(
          propertySchema,
          propertyValue,
          [...path, key],
        );
      }
      return result as jsonType<T>;
    }
    default: {
      throw new Error(`Unknown JSON type ${schema["type"]}`);
    }
  }
}

/**
 * JSON schema.
 */
export type JsonSchema =
  | { type: "string" }
  | { type: "number" }
  | { type: "integer" }
  | { type: "boolean" }
  | {
    type: "array";
    items: JsonSchema;
  }
  | {
    type: "object";
    properties: { [key: string]: JsonSchema };
    required?: readonly string[];
  };

/**
 * Returns the type of a JSON value based on its schema.
 *
 * @template T The {@link JsonSchema}.
 */
export type jsonType<T extends JsonSchema> = T extends { type: "string" }
  ? string
  : T extends { type: "number" } ? number
  : T extends { type: "integer" } ? number
  : T extends { type: "boolean" } ? boolean
  : T extends { type: "array"; items: infer I extends JsonSchema } ? (
      jsonType<I>[]
    )
  : T extends {
    type: "object";
    properties: infer P extends { [key: string]: JsonSchema };
  } ? (
      T extends { required: infer R extends readonly unknown[] } ? (
          & {
            [K in keyof P as K extends R[number] ? K : never]: jsonType<P[K]>;
          }
          & {
            [K in keyof P as K extends R[number] ? never : K]?:
              | jsonType<P[K]>
              | undefined;
          }
        )
        : (
          {
            [K in keyof P]?: jsonType<P[K]> | undefined;
          }
        )
    )
  : never;
