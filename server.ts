const assertType = <T>(_: T) => {};

class Api<
  const A extends Record<string, Endpoint<"string" | "number">>,
> {
  constructor(
    readonly api: A,
  ) {
  }

  handler = (request: Request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const endpoint = this.api[path];
    if (endpoint) {
      return endpoint.handle(request);
    }
    return new Response("Not found", { status: 404 });
  };
}

class Endpoint<
  T extends "string" | "number",
> {
  constructor(
    readonly paramType: T,
    readonly handler: (
      param: T extends "string" ? string : T extends "number" ? number : never,
    ) => Response,
  ) {
  }

  handle = (request: Request) => {
    const url = new URL(request.url);
    const param = url.searchParams.get("param");
    if (param === null) {
      return new Response("Bad request", { status: 400 });
    }
    switch (this.paramType) {
      case "string": {
        return this.handler(param as never);
      }
      case "number": {
        return this.handler(Number(param) as never);
      }
      default:
        throw new Error("Unreachable");
    }
  };
}

const api = new Api({
  "/hello": new Endpoint(
    "string",
    (param) => {
      assertType<string>(param);
      return new Response(`Hello ${param}`);
    },
  ),
  "/age": new Endpoint(
    "number",
    (param) => {
      assertType<number>(param);
      return new Response(`You are ${param} years old`);
    },
  ),
});

Deno.serve({ port: 8080 }, (request) => {
  const response = api.handler(request);
  return response;
});

class Client<
  const A extends Record<string, Endpoint<"string" | "number">>,
> {
  async request<T extends keyof A & string>(
    path: T,
    param: A[T] extends Endpoint<infer U>
      ? (U extends "string" ? string : U extends "number" ? number : never)
      : never,
  ) {
    const response = await fetch(`http://localhost:8080${path}?param=${param}`);
    return response.text();
  }
}

const client = new Client<typeof api["api"]>();

await client.request("/hello", "world");
await client.request("/age", 42);
