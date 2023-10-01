import { parseMediaType } from "https://deno.land/std@0.203.0/media_types/parse_media_type.ts";
import type { Api, RouteMap } from "../server/Api.ts";
import type { ApiResponse, Endpoint } from "../server/Endpoint.ts";
import type { BodySchema, bodyType } from "../server/body.ts";
import type { QuerySchema, queryType } from "../server/query.ts";

export class Client<
  const A extends Api<any>,
> {
  constructor(
    readonly baseUrl: string,
  ) {}

  async fetch<
    const P extends apiPath<A["api"]>,
    const M extends keyof pathMethods<A["api"], P> & string,
  >(
    path: P,
    method: M,
    input: optionalIfEmpty<omitNullish<pathInput<A["api"], P, M>>>,
  ): Promise<pathOutput<A["api"], P, M>> {
    const { query, body } = (input ?? {}) as pathInput<A["api"], P, M>;
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const key in query) {
        url.searchParams.set(key, String(query[key]));
      }
    }
    const response = await fetch(url.toString(), {
      method,
      body: typeof body == "string"
        ? body
        : body !== undefined
        ? JSON.stringify(body)
        : undefined,
    });
    const responseContentType = response.headers.get("content-type");
    const [responseType, _responseTypeParams] = responseContentType
      ? parseMediaType(responseContentType)
      : [null, null];
    switch (responseType) {
      case null:
      case "text/plain": {
        return {
          status: response.status,
          type: "text/plain",
          body: await response.text(),
        } as pathOutput<A["api"], P, M>;
      }
      case "application/json": {
        return {
          status: response.status,
          type: "application/json",
          body: await response.json(),
        } as pathOutput<A["api"], P, M>;
      }
      default: {
        console.log(response);
        throw new Error(`Unknown response type ${responseType}`);
      }
    }
  }
}

type apiPath<
  A extends RouteMap,
> = {
  [K in keyof A & string]: A[K] extends Api<infer B> ? `${K}/${apiPath<B>}`
    : A[K] extends object ? `${K}`
    : never;
}[keyof A & string];

type pathMethods<
  A extends RouteMap,
  P extends string,
> = P extends keyof A & string ? ({
    [K in keyof A[P] & string]: A[P][K] extends
      Endpoint<QuerySchema, BodySchema, ApiResponse> ? A[P][K]
      : never;
  })
  : P extends `${infer K extends keyof A & string}/${infer R}`
    ? (A[K] extends Api<infer B> ? pathMethods<B, R> : never)
  : never;

type pathInput<
  A extends RouteMap,
  P extends string,
  M extends keyof pathMethods<A, P>,
> = pathMethods<A, P>[M] extends
  Endpoint<infer Q extends QuerySchema, infer B extends BodySchema>
  ? { query: queryType<Q>; body: bodyType<B> }
  : never;

type pathOutput<
  A extends RouteMap,
  P extends string,
  M extends keyof pathMethods<A, P>,
> = pathMethods<A, P>[M] extends Endpoint<
  QuerySchema,
  BodySchema,
  infer R extends ApiResponse
> ?
    | R
    | { status: 400; type: "text/plain"; body: string }
    | { status: 500; type: "text/plain"; body: string }
  : never;

/**
 * Make object's properties optional if their type is just undefined or null
 */
type omitNullish<T> =
  | T
  | {
    [K in keyof T as T[K] extends undefined | null ? never : K]: T[K];
  };

/**
 * If whole object is optional, allow it to be nullish
 */
type optionalIfEmpty<T> = {
  [K in keyof T]: T[K];
} extends { [K in keyof T]?: T[K] } ? T | null | undefined | void
  : T;
