import { Endpoint, Handler, Output } from "../common/Handler.ts";
import { InputSchema, inputType, transformInput } from "./transformInput.ts";
// deno-lint-ignore no-unused-vars
import { createPathFilter } from "./createPathFilter.ts";
import { transformOutput } from "./transformOutput.ts";

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
  const IS extends InputSchema = InputSchema,
  const O extends Output = Output,
>(
  schema: IS,
  handler: (input: inputType<IS>) => Promise<O>,
): Handler<{
  "": {
    [M in string]: Endpoint<inputType<IS>, O | DefaultOutput>;
  };
}> {
  return async (request, _info, params) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    let input;
    try {
      input = await transformInput(request, schema);
    } catch (error) {
      return new Response(`Bad request: ${error.message}`, { status: 400 });
    }

    const output = await handler({
      ...input,
      params: { ...input.params, ...params },
    });

    return transformOutput(output);
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
