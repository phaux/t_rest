import { QuerySchema, queryType, validateQuery } from "./query.ts";
import { BodySchema, bodyType, validateBody } from "./body.ts";

export class Endpoint<
  const Q extends QuerySchema = QuerySchema,
  const B extends BodySchema = BodySchema,
  const R extends ApiResponse = ApiResponse,
> {
  #handler: (input: {
    query: unknown;
    body: unknown;
  }) => R;

  constructor(
    readonly schema: { query: Q; body: B },
    handler: (input: { query: queryType<Q>; body: bodyType<B> }) => R,
  ) {
    this.#handler = handler as any;
  }

  handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    let requestQuery: unknown;
    try {
      requestQuery = validateQuery(this.schema.query, url.searchParams);
    } catch (error) {
      return new Response(`Bad request: Invalid query: ${error.message}`, {
        status: 400,
      });
    }

    let requestBody: unknown;
    try {
      requestBody = await validateBody(this.schema.body, request);
    } catch (error) {
      return new Response(`Bad request: Invalid body: ${error.message}`, {
        status: 400,
      });
    }

    const response = this.#handler({
      query: requestQuery,
      body: requestBody,
    });

    switch (response.type) {
      case "text/plain": {
        return new Response(response.body, { status: response.status });
      }
      case "application/json": {
        return new Response(JSON.stringify(response.body), {
          status: response.status,
          headers: { "content-type": "application/json" },
        });
      }
      default: {
        throw new Error(
          `Unknown response body type ${(requestBody as any).type}`,
        );
      }
    }
  };
}

export type ApiResponse =
  & { status: number }
  & (
    | { type: "text/plain"; body: string }
    | { type: "application/json"; body: unknown }
  );
