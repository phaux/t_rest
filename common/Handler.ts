import { BodySchema, bodyType } from "../server/validateBody.ts";
import { QuerySchema, queryType } from "../server/validateQuery.ts";
import { Nullable } from "./Nullable.ts";

declare const api: unique symbol;

/**
 * Request handler with a hidden {@link Api} type.
 *
 * The handler value is just a function taking {@link Request} and returning {@link Response}
 * and can be passed to {@link Deno.serve}.
 *
 * The hidden type should be a subtype of {@link Api}.
 * It is then used to infer the types for the client.
 *
 * The second argument of the handler is an info object which `Deno.serve` passes, but it is ignored.
 * A handler can also receive a third argument which is a map of extracted path parameters.
 * Filters and middlewares use it internally.
 *
 * @template A The {@link Api} type.
 */
export type Handler<
  A = unknown, // can't use `Api` here because "not assignable" error
> =
  & ((
    request: Request,
    info?: unknown,
    params?: Record<string, string>,
  ) => Promise<Response>)
  & { [api]?: A };

/**
 * Type describing valid API endpoints.
 *
 * It's a map of paths to a map of methods to a {@link Endpoint}.
 */
export type Api = {
  [path: string]: {
    [method: string]: Endpoint;
  };
};

/**
 * Returns the {@link Api} type of a {@link Handler}.
 *
 * @template H The {@link Handler} type.
 */
export type handlerApi<H extends Handler> = NonNullable<
  H[typeof api]
>;

/**
 * Type contained in {@link Api} describing a single endpoint.
 *
 * It contains the {@link Input} and {@link Output} types of the endpoint.
 */
export type Endpoint<
  I extends Input = Input,
  O extends Output = Output,
> = {
  input: I;
  output: O;
};

/**
 * Type describing the input of an {@link Api}'s {@link Endpoint}.
 */
export type Input<
  Q extends AnyQuery = AnyQuery,
  B extends AnyBody = AnyBody,
> = {
  params: Record<string, string>;
  query: Q;
  body: B;
};

/**
 * Type describing the output of an {@link Api}'s {@link Endpoint}.
 */
export type Output<
  B extends bodyType<BodySchema> = bodyType<BodySchema>,
> = {
  status: number;
  body: B;
};

export type AnyQuery = Nullable<queryType<QuerySchema>>;
export type AnyBody = Nullable<bodyType<BodySchema>>;
