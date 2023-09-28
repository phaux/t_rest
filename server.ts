export class Api<
  const A extends Record<string, Endpoint<"string" | "number">>,
> {
  constructor(
    readonly api: A,
  ) {
  }

  serve = (request: Request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const endpoint = this.api[path];
    if (endpoint) {
      return endpoint.handle(request);
    }
    return new Response("Not found", { status: 404 });
  };
}

export class Endpoint<
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
