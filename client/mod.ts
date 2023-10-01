import { parseMediaType } from "https://deno.land/std@0.203.0/media_types/parse_media_type.ts";
import type { Api, RouteMap } from "../server/Api.ts";
import type { ApiResponse, Endpoint } from "../server/Endpoint.ts";
import type { BodySchema, bodyType } from "../server/body.ts";
import type { QuerySchema, queryType } from "../server/query.ts";

/**
 * Client for TREST API.
 *
 * @template A The API type.
 */
export class Client<
  const A extends Api<RouteMap>,
> {
  /**
   * Initialize a new client.
   */
  constructor(
    readonly baseUrl: string,
  ) {}

  /**
   * Fetch the given endpoint from the API.
   */
  async fetch<
    const P extends apiPath<A["api"]>,
    const M extends keyof pathMethods<A["api"], P> & string,
  >(
    path: P,
    method: M,
    input: pathInput<A["api"], P, M>,
  ): Promise<pathOutput<A["api"], P, M>> {
    const { query, type, body } = input ?? {};
    const requestUrl = new URL(path, this.baseUrl);
    if (query) {
      for (const key in query) {
        requestUrl.searchParams.set(key, String(query[key]));
      }
    }
    const request: RequestInit = { method };
    if (type) {
      switch (type) {
        case "text/plain": {
          request.body = body;
          break;
        }
        case "application/json": {
          request.headers = { "content-type": "application/json" };
          request.body = JSON.stringify(body);
          break;
        }
        case "multipart/form-data": {
          const formData = new FormData();
          for (const key in body) {
            const value = body[key];
            if (typeof value == "string" || typeof value == "number") {
              formData.set(key, String(value));
            }
            if (typeof value == "object" && value != null) {
              const jsonBlob = new Blob([JSON.stringify(value)], {
                type: "application/json",
              });
              formData.set(key, jsonBlob);
            }
            if ((value as any) instanceof Blob) {
              formData.set(key, value);
            }
          }
          request.body = formData;
          break;
        }
      }
    }

    const response = await fetch(requestUrl, request);
    const [responseType, _] = parseMediaType(
      response.headers.get("content-type") ?? "text/plain",
    );

    switch (responseType) {
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

/**
 * Returns all valid request paths for an {@link Api}.
 *
 * @template A The API type.
 */
export type apiPath<
  A extends RouteMap,
> = {
  [K in keyof A & string]: A[K] extends Api<infer B> ? `${K}/${apiPath<B>}`
    : A[K] extends object ? `${K}`
    : never;
}[keyof A & string];

/**
 * Returns all valid HTTP methods for a given path.
 *
 * @template A The API type.
 * @template P The request path.
 */
export type pathMethods<
  A extends RouteMap,
  P extends string,
> = P extends keyof A & string ? ({
    [K in keyof A[P] & string]: A[P][K] extends
      Endpoint<QuerySchema | undefined | null, BodySchema | undefined | null>
      ? A[P][K]
      : never;
  })
  : P extends `${infer K extends keyof A & string}/${infer R}`
    ? (A[K] extends Api<infer B> ? pathMethods<B, R> : never)
  : never;

/**
 * Returns the request input type for a given path and HTTP method.
 *
 * @template A The API type.
 * @template P The request path.
 * @template M The HTTP method.
 */
export type pathInput<
  A extends RouteMap,
  P extends string,
  M extends keyof pathMethods<A, P>,
> = pathMethods<A, P>[M] extends Endpoint<
  infer Q extends QuerySchema | undefined | null,
  infer B extends BodySchema | undefined | null
> ?
    & (Q extends object ? { query: queryType<Q> }
      : { query?: undefined | null } | undefined | null)
    & (B extends object ? { type: B["type"]; body: bodyType<B> }
      : { type?: undefined | null; body?: undefined | null } | undefined | null)
  : never;

/**
 * Returns the response output type for a given path and HTTP method.
 *
 * The 500 response is always a valid response
 * because it is used when an exception is thrown in the handler.
 *
 * Similarly, the 400 response is always a valid response
 * because some invalid requests can be represented in the type system (e.g. integer).
 *
 * @template A The API type.
 * @template P The request path.
 * @template M The HTTP method.
 */
export type pathOutput<
  A extends RouteMap,
  P extends string,
  M extends keyof pathMethods<A, P>,
> = pathMethods<A, P>[M] extends Endpoint<
  QuerySchema | undefined | null,
  BodySchema | undefined | null,
  infer R extends ApiResponse
> ?
    | R
    | (ApiResponse & { status: 400 | 500; type: "text/plain" })
  : never;
