import { Endpoint, Handler, handlerApi, Input } from "../common/Handler.ts";
import { Nullish } from "../common/Nullable.ts";

/**
 * Returns union of all paths accepted by a {@link Handler}.
 *
 * @template H The {@link Handler} type.
 */
export type handlerPath<H extends Handler> =
  & keyof handlerApi<H>
  & string;

/**
 * Returns union of all methods accepted by a {@link Handler} for a given {@link handlerPath}.
 *
 * @template H The {@link Handler} type.
 * @template P The {@link handlerPath}.
 */
export type handlerMethod<H extends Handler, P extends handlerPath<H>> =
  & keyof handlerApi<H>[P]
  & string;

/**
 * Returns the input type accepted by a {@link Handler} for a given {@link handlerPath} and {@link handlerMethod}.
 *
 * @template H The {@link Handler} type.
 * @template P The {@link handlerPath}.
 * @template M The {@link handlerMethod}.
 */
export type handlerInput<
  H extends Handler,
  P extends handlerPath<H>,
  M extends handlerMethod<H, P>,
> = handlerApi<H>[P][M] extends Endpoint<infer I>
  ? (I extends { query: infer Q; body: infer B } ? (
      & (Q extends object ? { query: Q } : { query?: Nullish })
      & (B extends object ? { body: B } : { body?: Nullish })
    )
    : never)
  : never;

/**
 * Returns the output type returned by a {@link Handler} for a given {@link handlerPath} and {@link handlerMethod}.
 *
 * @template H The {@link Handler} type.
 * @template P The {@link handlerPath}.
 * @template M The {@link handlerMethod}.
 */
export type handlerOutput<
  H extends Handler,
  P extends handlerPath<H>,
  M extends handlerMethod<H, P>,
> = handlerApi<H>[P][M] extends Endpoint<Input, infer O> ? O : never;
