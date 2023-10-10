/**
 * Validates a query string against a query string schema.
 *
 * @internal
 */
export function validateQuery<QS extends QuerySchema>(
  schema: QS,
  value: URLSearchParams,
): queryType<QS> {
  const result: Record<string, unknown> = {};
  for (const [paramName, paramSchema] of Object.entries(schema)) {
    const paramValue = value.get(paramName);
    if (paramValue == null) {
      throw new Error(`Missing param ${paramName}`);
    }
    switch (paramSchema.type) {
      case "string": {
        result[paramName] = paramValue;
        break;
      }
      case "number": {
        const value = parseFloat(paramValue);
        if (isNaN(value)) {
          throw new Error(`Expected param ${paramName} to be a number`);
        }
        result[paramName] = value;
        break;
      }
      case "integer": {
        const number = parseInt(paramValue, 10);
        if (isNaN(number)) {
          throw new Error(`Expected param ${paramName} to be an integer`);
        }
        result[paramName] = number;
        break;
      }
      default: {
        throw new Error(`Unknown query type ${paramSchema["type"]}`);
      }
    }
  }
  return result as queryType<QS>;
}

/**
 * Query string schema.
 */
export type QuerySchema = {
  [key: string]: {
    type: "string" | "number" | "integer";
  };
};

/**
 * Returns the type of a query string data based on its schema.
 *
 * @template QS The {@link QuerySchema}.
 */
export type queryType<QS extends QuerySchema> = {
  -readonly [K in keyof QS]: QS[K]["type"] extends "string" ? string
    : QS[K]["type"] extends "number" ? number
    : QS[K]["type"] extends "integer" ? number
    : never;
};
