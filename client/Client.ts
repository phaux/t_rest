import type { Api, RouteMap } from "../server/Api.ts";
import type { ApiResponse, Endpoint } from "../server/Endpoint.ts";
import type { BodySchema, bodyType } from "../server/body.ts";
import type { QuerySchema, queryType } from "../server/query.ts";

/**
 * Client for an {@link Api}.
 *
 * Pass `typeof yourApi` as the type parameter to infer all the Api types.
 *
 * @template A The API type.
 */
export class Client<
  A extends Api<RouteMap>,
> {
  /**
   * Initializes a new client.
   */
  constructor(
    readonly baseUrl: string,
  ) {}

  /**
   * Fetches the given endpoint from the API.
   */
  async fetch<
    P extends apiPath<A["api"]>,
    M extends keyof pathMethods<A["api"], P> & string,
  >(
    path: P,
    method: M,
    input: pathInput<A["api"], P, M>,
  ): Promise<pathOutput<A["api"], P, M>> {
    const { query, type, body } = input ?? {};
    const requestUrl = new URL(path, this.baseUrl);
    if (query) {
      for (const [paramName, paramValue] of Object.entries(query)) {
        requestUrl.searchParams.set(paramName, String(paramValue));
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
          for (const [fieldName, fieldValue] of Object.entries(body)) {
            if ((fieldValue as any) instanceof Blob) {
              console.log(fieldName, "blob", fieldValue);
              formData.set(fieldName, fieldValue);
            } else if (typeof fieldValue == "object" && fieldValue != null) {
              console.log(fieldName, "json", fieldValue);
              const jsonBlob = new Blob([JSON.stringify(fieldValue)], {
                type: "application/json",
              });
              formData.set(fieldName, jsonBlob);
            } else if (
              typeof fieldValue == "string" || typeof fieldValue == "number"
            ) {
              console.log(fieldName, "simple", fieldValue);
              formData.set(fieldName, String(fieldValue));
            }
          }
          request.body = formData;
          break;
        }
      }
    }

    const response = await fetch(requestUrl, request);
    const responseType = response.headers.get("content-type")
      ?.split(";").shift()?.trim().toLowerCase() ?? "text/plain";

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
 * Returns all valid HTTP methods for a given {@link Api} and a path.
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
 * Returns the request input type for a given {@link Api}, path and HTTP method.
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
 * Returns the response output type for a given {@link Api}, path and HTTP method.
 *
 * The 500 response is always valid
 * because it is used when an exception is thrown in the handler.
 * Similarly, the 400 response is always possible
 * because some invalid requests can't be prevented by the type system (e.g. integer).
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
