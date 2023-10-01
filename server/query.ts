export function validateQuery<T extends QuerySchema>(
  schema: T,
  value: URLSearchParams,
): queryType<T> {
  const result: Record<string, unknown> = {};
  for (const key in schema) {
    const paramSchema = schema[key];
    const paramValue = value.get(key);
    if (paramValue == null) {
      throw new Error(`Missing param ${key}`);
    }
    switch (paramSchema.type) {
      case "string": {
        result[key] = paramValue;
        break;
      }
      case "number": {
        const value = parseFloat(paramValue);
        if (isNaN(value)) {
          throw new Error(`Expected ${key} to be a number`);
        }
        result[key] = value;
        break;
      }
      case "integer": {
        const number = parseInt(paramValue, 10);
        if (isNaN(number)) {
          throw new Error(`Expected ${key} to be an integer`);
        }
        result[key] = number;
        break;
      }
      default: {
        throw new Error(`Unknown query type ${paramSchema["type"]}`);
      }
    }
  }
  return result as queryType<T>;
}

export type QuerySchema = {
  [key: string]: {
    type: "string" | "number" | "integer";
  };
};

export type queryType<T extends QuerySchema> = {
  [K in keyof T]: T[K]["type"] extends "string" ? string
    : T[K]["type"] extends "number" ? number
    : T[K]["type"] extends "integer" ? number
    : never;
};
