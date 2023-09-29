import { escape } from "https://deno.land/std@0.203.0/regexp/escape.ts";

export class Api<
  const A extends { [path: string]: Endpoint<QuerySchema> | Api<any> },
> {
  constructor(
    readonly api: A,
  ) {
  }

  serve = (request: Request): Response => {
    const url = new URL(request.url);
    const path = url.pathname;
    for (const key in this.api) {
      // turn key into regexp where {param} become capture groups
      const keyRegexp = new RegExp(
        `^/${escape(key)}(?<rest>|/.*)$`
          .replace(
            /\\\{([\w][\w\d]*)\\\}/g,
            (_match, param) => `(?<${param}>[^/]+)`,
          ),
        "u",
      );
      const match = keyRegexp.exec(path);
      if (match == null) continue;
      const endpoint = this.api[key];
      const subUrl = new URL(url);
      subUrl.pathname = match.groups?.rest!;
      const subRequest = new Request(subUrl, request);
      if (endpoint instanceof Endpoint && subUrl.pathname === "/") {
        return endpoint.handle(subRequest);
      }
      if (endpoint instanceof Api) {
        return endpoint.serve(subRequest);
      }
    }
    return new Response("Not found", { status: 404 });
  };
}

export class Endpoint<
  const T extends QuerySchema,
> {
  readonly #handler: (params: Record<string, unknown>) => Response;

  constructor(
    readonly paramsSchema: T,
    handler: (
      params: queryType<T>,
    ) => Response,
  ) {
    this.#handler = handler as any;
  }

  handle = (request: Request) => {
    const url = new URL(request.url);
    const params = url.searchParams;
    const query: Record<string, unknown> = {};
    for (const key in this.paramsSchema) {
      const paramSchema = this.paramsSchema[key];
      const param = params.get(key);
      if (param == null) {
        return new Response(`Missing param ${key}`, { status: 400 });
      }
      if (paramSchema.type === "string") {
        query[key] = param;
      }
      if (paramSchema.type === "number") {
        const number = parseFloat(param);
        if (isNaN(number)) {
          return new Response(`Invalid number param ${key}`, { status: 400 });
        }
        query[key] = number;
      }
      if (paramSchema.type === "integer") {
        const number = parseInt(param, 10);
        if (isNaN(number)) {
          return new Response(`Invalid integer param ${key}`, { status: 400 });
        }
        query[key] = number;
      }
    }
    return this.#handler(query);
  };
}

export type queryType<T extends QuerySchema> = {
  [K in keyof T]: T[K]["type"] extends "string" ? string
    : T[K]["type"] extends "number" ? number
    : T[K]["type"] extends "integer" ? number
    : never;
};

export type QuerySchema = {
  [key: string]: {
    type: "string" | "number" | "integer";
  };
};
