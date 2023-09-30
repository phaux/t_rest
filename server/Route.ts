import { QuerySchema, queryType, validateQuery } from "./validateQuery.ts";
import { JsonSchema, jsonType, validateJson } from "./validateJson.ts";

export class Route<
  const T extends QuerySchema,
  const B extends BodySchema = void,
> {
  #handler: (input: {
    query: unknown;
    body: unknown;
  }) => Response;

  constructor(
    readonly schema: { query: T; body: B },
    handler: (input: {
      query: queryType<T>;
      body: bodyType<B>;
    }) => Response,
  ) {
    this.#handler = handler as any;
  }

  handle = async (request: Request) => {
    const url = new URL(request.url);

    let query: unknown;
    try {
      query = validateQuery(this.schema.query, url.searchParams);
    } catch (error) {
      return new Response(`Bad request: Invalid query: ${error.message}`, {
        status: 400,
      });
    }

    let body: unknown = undefined;
    switch (this.schema.body?.type) {
      case "string": {
        body = await request.text();
        break;
      }
      case "json": {
        const bodyText = await request.text();
        try {
          body = validateJson(this.schema.body.schema, JSON.parse(bodyText));
        } catch (error) {
          return new Response(`Bad request: Invalid body: ${error.message}`, {
            status: 400,
          });
        }
        break;
      }
      case undefined: {
        break;
      }
      default: {
        throw new Error(`Unknown body type ${(this.schema.body as any).type}`);
      }
    }

    return this.#handler({ query, body });
  };
}

export type BodySchema =
  | void
  | { type: "string" }
  | { type: "json"; schema: JsonSchema };

export type bodyType<T extends BodySchema> = T extends void ? undefined
  : T extends { type: "string" } ? string
  : T extends { type: "json"; schema: infer S extends JsonSchema } ? jsonType<S>
  : never;
