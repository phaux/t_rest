import { QuerySchema, queryType, validateQuery } from "./query.ts";
import { BodySchema, bodyType, validateBody } from "./body.ts";

/**
 * A single endpoint of an {@link Api}.
 */
export class Endpoint<
  const Q extends QuerySchema | undefined | null,
  const B extends BodySchema | undefined | null,
  const R extends ApiResponse = ApiResponse,
> {
  #handler: (input: {
    query: unknown;
    body: unknown;
  }) => Promise<R>;

  /**
   * Defines a new endpoint.
   *
   * Provided schema will be used to validate incoming requests and to infer the input type of the handler.
   *
   * Provided handler will be run when a request matches and must return a valid {@link ApiResponse}.
   *
   * @example
   * ```ts
   * const api = new Api({
   *   "hello": {
   *     GET: new Endpoint(
   *       {
   *         query: { name: { type: "string" } },
   *         body: {
   *           type: "application/json",
   *           schema: {
   *             type: "object",
   *             properties: {
   *               age: { type: "number" },
   *             },
   *           },
   *         },
   *       },
   *       async ({ query, body }) => {
   *         return {
   *           status: 200,
   *           type: "text/plain",
   *           body: `Hello ${query.name}, you are ${body.age} years old`,
   *         };
   *       },
   *     ),
   *   },
   * });
   * ```
   */
  constructor(
    readonly schema: { query: Q; body: B },
    handler: (
      input: {
        query: Q extends object ? queryType<Q> : undefined | null;
        body: B extends object ? bodyType<B> : undefined | null;
      },
    ) => Promise<R>,
  ) {
    this.#handler = handler as any;
  }

  /**
   * Handle a standard {@link Request} and return a {@link Response} based on provided endpoint definition.
   *
   * This is used internally by {@link Api} but can also be used directly.
   *
   * @internal
   */
  handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    let requestQuery: unknown = undefined;
    if (this.schema.query != null) {
      try {
        requestQuery = validateQuery(this.schema.query, url.searchParams);
      } catch (error) {
        return new Response(`Bad request: Invalid query: ${error.message}`, {
          status: 400,
        });
      }
    }

    let requestBody: unknown;
    if (this.schema.body != null) {
      try {
        requestBody = await validateBody(this.schema.body, request);
      } catch (error) {
        return new Response(`Bad request: Invalid body: ${error.message}`, {
          status: 400,
        });
      }
    }

    const response = await this.#handler({
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
          `Unknown response body type ${(requestBody as never)["type"]}`,
        );
      }
    }
  };
}

/**
 * Response returned by an {@link Endpoint}'s handler.
 */
export type ApiResponse =
  & { status: number }
  & (
    | { type: "text/plain"; body: string }
    | { type: "application/json"; body: unknown }
  );
