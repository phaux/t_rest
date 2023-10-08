import { Endpoint, Handler, Input, Output } from "../common/Handler.ts";
import { Nullable, Nullish } from "../common/Nullable.ts";
import { initFormData } from "../common/initFormData.ts";
// deno-lint-ignore no-unused-vars
import { createPathFilter } from "./createPathFilter.ts";
import { BodySchema, bodyType, validateBody } from "./validateBody.ts";
import { QuerySchema, queryType, validateQuery } from "./validateQuery.ts";

/**
 * Returns a {@link Handler} that validates the request against a given schema and calls the provided function if it's valid.
 *
 * If the request is valid, the provided function is called with a inferred subtype of an {@link Input} object.
 * The provided function should return a subtype of an {@link Output} object.
 *
 * If the request path is not an empty path (`/`), a 404 response is returned.
 * Use {@link createPathFilter} to create a handler that matches and strips a prefix from the request path.
 *
 * If the request query or body is invalid, a 400 response is returned.
 *
 * If the provided function throws an error, a 500 response is returned.
 *
 * Otherwise, the provided function is called and its return value is used to create a response.
 *
 * The defined endpoint schema is also used to infer valid request input for the client.
 * The return value of the provided function is used to infer the response body type.
 * The response type will also always include the {@link DefaultOutput} type.
 */
export function createEndpoint<
  const Q extends Nullable<QuerySchema>,
  const B extends Nullable<BodySchema>,
  const O extends Output = Output,
>(
  schema: { query: Q; body: B },
  handler: (
    input: Input<
      Q extends object ? queryType<Q> : Nullish,
      B extends object ? bodyType<B> : Nullish
    >,
  ) => Promise<O>,
): Handler<{
  "": {
    [M in string]: Endpoint<
      Input<
        Q extends object ? queryType<Q> : Nullish,
        B extends object ? bodyType<B> : Nullish
      >,
      O | DefaultOutput
    >;
  };
}> {
  return async (request, _info, params) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    let requestQuery: queryType<NonNullable<Q>> | undefined;
    if (schema.query != null) {
      try {
        requestQuery = validateQuery(schema.query, requestUrl.searchParams);
      } catch (error) {
        return new Response(`Bad request: Invalid query: ${error.message}`, {
          status: 400,
        });
      }
    } else {
      requestQuery = undefined;
    }

    let requestBody: bodyType<NonNullable<B>> | undefined;
    if (schema.body != null) {
      try {
        requestBody = await validateBody(schema.body, request);
      } catch (error) {
        return new Response(`Bad request: Invalid body: ${error.message}`, {
          status: 400,
        });
      }
    } else {
      requestBody = undefined;
    }

    const response = await handler({
      params: params ?? {},
      query: requestQuery as Q extends object ? queryType<Q> : undefined | null,
      body: requestBody as B extends object ? bodyType<B> : undefined | null,
    });

    switch (response.body.type) {
      case "text/plain": {
        return new Response(response.body.data, {
          status: response.status,
        });
      }
      case "application/json": {
        return new Response(JSON.stringify(response.body.data), {
          status: response.status,
          headers: { "content-type": "application/json" },
        });
      }
      case "multipart/form-data": {
        return new Response(initFormData(response.body.data), {
          status: response.status,
        });
      }
      default: {
        throw new Error(
          `Unknown response body type ${response.body["type"]}`,
        );
      }
    }
  };
}

/**
 * {@link Output} type that can be always returned from a {@link Handler} obtained from {@link createEndpoint} in addition to the defined output.
 *
 * Includes a 400 response, because some invalid input types can't be represented in the type system
 * and will return a 400 response even if the input types on the client are correct.
 * For example, an integer type in schema is a number type in the client.
 *
 * Also includes a 500 response, because the provided function can throw an error
 * and there is no way to check if a function throws or not in TypeScript.
 */
export type DefaultOutput = {
  status: 400 | 500;
  body: { type: "text/plain"; data: string };
};
