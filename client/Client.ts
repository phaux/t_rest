import { BodySchema, bodyType, Route } from "../server/Route.ts";
import { QuerySchema, queryType } from "../server/validateQuery.ts";
import { Api, RouteMap } from "../server/Api.ts";

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
    input: pathInput<A["api"], P, M>,
  ) {
    const url = new URL(path, this.baseUrl);
    if (input.query) {
      for (const key in input.query) {
        url.searchParams.set(key, String(input.query[key]));
      }
    }
    let body: BodyInit | undefined;
    if (typeof input.body == "string") {
      body = input.body;
    } else if (input.body) {
      body = JSON.stringify(input.body);
    }
    const response = await fetch(url.toString(), {
      method,
      body,
    });
    return response.text();
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
    [K in keyof A[P] & string]: A[P][K] extends Route<infer Q, infer B>
      ? { query: Q; body: B }
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
  { query: infer Q extends QuerySchema; body: infer B extends BodySchema }
  ? { query: queryType<Q>; body: bodyType<B> }
  : never;
