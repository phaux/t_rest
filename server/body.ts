import { JsonSchema, jsonType, validateJson } from "./json.ts";

export async function validateBody(schema: BodySchema, request: Request) {
  switch (schema?.type) {
    case "text/plain": {
      return await request.text();
    }
    case "application/json": {
      const bodyText = await request.text();
      try {
        return validateJson(
          schema.schema,
          JSON.parse(bodyText),
        );
      } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
    }
    case undefined: {
      return undefined;
    }
    default: {
      throw new Error(
        `Unknown body type ${(schema as any).type}`,
      );
    }
  }
}

export type BodySchema =
  | undefined
  | null
  | { type: "text/plain" }
  | { type: "application/json"; schema: JsonSchema };

export type bodyType<T extends BodySchema> = T extends object ? (
    T extends { type: "text/plain" } ? string
      : T extends
        { type: "application/json"; schema: infer S extends JsonSchema }
        ? jsonType<S>
      : never
  )
  : undefined;
