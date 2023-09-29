import { Api, Endpoint, QuerySchema, queryType } from "./server.ts";

type apiPath<
  A extends { [path: string]: Endpoint<QuerySchema> | Api<any> },
> = {
  [K in keyof A & string]: A[K] extends Endpoint<any> ? `${K}`
    : A[K] extends Api<infer B> ? `${K}/${apiPath<B>}`
    : never;
}[keyof A & string];

type pathParams<
  A extends { [path: string]: Endpoint<QuerySchema> | Api<any> },
  P extends string,
> = P extends keyof A & string ? (
    A[P] extends Endpoint<infer T> ? T : never
  )
  : P extends `${infer K extends keyof A & string}/${infer R}` ? (
      A[K] extends Api<infer B> ? pathParams<B, R>
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
    const url = new URL(path, this.baseUrl);
    for (const key in params) {
      url.searchParams.set(key, params[key] as string);
    }
    const response = await fetch(url);
    return response.text();
  }
}
