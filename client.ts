import { Api, Endpoint, QuerySchema, queryType } from "./server.ts";

type apiPath<
  A extends { [path: string]: Endpoint<QuerySchema> | Api<any> },
> = {
  [K in keyof A & string]: A[K] extends Endpoint<any> ? readonly [K]
    : A[K] extends Api<infer B> ? readonly [K, ...apiPath<B>]
    : never;
}[keyof A & string];

type pathParams<
  A extends { [path: string]: Endpoint<QuerySchema> | Api<any> },
  P extends readonly string[],
> = P extends
  readonly [infer K extends keyof A & string, ...infer R extends string[]] ? (
    A[K] extends Endpoint<infer T> ? T
      : A[K] extends Api<infer B> ? pathParams<B, R>
      : never
  )
  : never;

export class Fetcher<
  const A extends { [path: string]: Endpoint<QuerySchema> | Api<any> },
> {
  constructor(
    readonly baseUrl: string,
  ) {}

  async fetch<const P extends apiPath<A>>(
    path: P,
    params: queryType<pathParams<A, P>>,
  ) {
    const url = new URL(path.join(""), this.baseUrl);
    for (const key in params) {
      url.searchParams.set(key, params[key] as string);
    }
    const response = await fetch(url);
    return response.text();
  }
}
