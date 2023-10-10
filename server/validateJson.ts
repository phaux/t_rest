/**
 * Validates a JSON value against a JSON schema.
 *
 * @internal
 */
export function validateJson<JS extends JsonSchema>(
  schema: JS,
  value: unknown,
  path: Array<string | number> = [],
): jsonType<JS> {
  const schemaTypes = Array.isArray(schema.type)
    ? schema.type
    : schema.type != null
    ? [schema.type]
    : [];

  const getError = (actual: string) =>
    new Error(
      `Expected ${path.join(".") || "value"} to be ${
        schemaTypes.join("|")
      } but got ${actual}`,
    );

  if (value == null) {
    if (!schemaTypes.includes("null")) throw getError(String(value));
    return value as jsonType<JS>;
  }

  if (typeof value == "string") {
    if (!schemaTypes.includes("string")) throw getError("string");
    return value as jsonType<JS>;
  }

  if (typeof value == "number") {
    if (!schemaTypes.includes("number")) throw getError("number");
    return value as jsonType<JS>;
  }

  if (typeof value == "boolean") {
    if (!schemaTypes.includes("boolean")) throw getError("boolean");
    return value as jsonType<JS>;
  }

  if (Array.isArray(value)) {
    if (!schemaTypes.includes("array")) throw getError("array");
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index++) {
      result[index] = validateJson(
        schema.items ?? {},
        value[index],
        [...path, index],
      );
    }
    return result as jsonType<JS>;
  }

  if (typeof value == "object") {
    if (!schemaTypes.includes("object")) throw getError("object");
    const result: Record<string, unknown> = {};
    if (schema.required != null) {
      for (const prop of schema.required) {
        if (!(prop in value)) {
          throw new Error(
            `Missing required property ${[...path, prop].join(".")}`,
          );
        }
      }
    }
    for (const [propName, propValue] of Object.entries(value)) {
      result[propName] = validateJson(
        schema.properties?.[propName] ?? schema.additionalProperties ?? {},
        propValue,
        [...path, propName],
      );
    }
    return value as jsonType<JS>;
  }

  throw getError(typeof value);
}

/**
 * JSON schema.
 */
export type JsonSchema = {
  type?: JsonType | readonly JsonType[];
  items?: JsonSchema;
  properties?: { [key: string]: JsonSchema };
  additionalProperties?: JsonSchema;
  required?: readonly string[];
};

type JsonType = "null" | "string" | "number" | "boolean" | "array" | "object";

/**
 * Returns the type of a JSON value based on its schema.
 *
 * @template JS The {@link JsonSchema}.
 */
export type jsonType<JS extends JsonSchema> =
  | (
    "null" extends arrayValues<JS["type"]> ? null : never
  )
  | (
    "string" extends arrayValues<JS["type"]> ? string : never
  )
  | (
    "number" extends arrayValues<JS["type"]> ? number : never
  )
  | (
    "boolean" extends arrayValues<JS["type"]> ? boolean : never
  )
  | (
    "array" extends arrayValues<JS["type"]> ? (
        & unknown[]
        & (
          JS extends { items: infer S extends JsonSchema } ? jsonType<S>[]
            : never
        )
      )
      : never
  )
  | (
    "object" extends arrayValues<JS["type"]> ? (
        & object
        & (
          JS extends
            { properties: infer P extends { [key: string]: JsonSchema } } ? (
              JS extends { required: infer R extends readonly unknown[] } ? (
                  & {
                    -readonly [K in keyof P as K extends R[number] ? K : never]:
                      jsonType<P[K]>;
                  }
                  & {
                    -readonly [
                      K in keyof P as K extends R[number] ? never : K
                    ]?:
                      | jsonType<P[K]>
                      | undefined;
                  }
                )
                : {
                  -readonly [K in keyof P]?: jsonType<P[K]> | undefined;
                }
            )
            : object
        )
        & (
          JS extends { additionalProperties: infer A extends JsonSchema } ? (
              { [key: string]: jsonType<A> }
            )
            : object
        )
      )
      : never
  );

type arrayValues<T> = T extends readonly unknown[] ? T[number]
  : T extends string ? T
  : never;
