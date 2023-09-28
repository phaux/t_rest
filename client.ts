import { Endpoint } from "./server.ts";

export class Fetcher<
  const A extends Record<string, Endpoint<"string" | "number">>,
> {
  constructor(
    readonly baseUrl: string,
  ) {}

  async fetch<T extends keyof A & string>(
    path: T,
    param: A[T] extends Endpoint<infer U>
      ? (U extends "string" ? string : U extends "number" ? number : never)
      : never,
  ) {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("param", String(param));
    const response = await fetch(url);
    return response.text();
  }
}
