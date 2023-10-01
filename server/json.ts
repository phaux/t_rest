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
        result[key] = validateJson(
          schema.properties[key],
          (value as any)[key],
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

export type JsonSchema =
  | { type: "string" }
  | { type: "number" }
  | { type: "integer" }
  | { type: "boolean" }
  | { type: "array"; items: JsonSchema }
  | { type: "object"; properties: { [key: string]: JsonSchema } };

export type jsonType<T extends JsonSchema> = T extends { type: "string" }
  ? string
  : T extends { type: "number" } ? number
  : T extends { type: "integer" } ? number
  : T extends { type: "boolean" } ? boolean
  : T extends { type: "array"; items: infer I extends JsonSchema }
    ? jsonType<I>[]
  : T extends { type: "object"; properties: infer P } ? {
      [K in keyof P]: P[K] extends JsonSchema ? jsonType<P[K]> : never;
    }
  : never;
