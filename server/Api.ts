import { escape } from "https://deno.land/std@0.203.0/regexp/escape.ts";
import { BodySchema, Route } from "./Route.ts";
import { QuerySchema } from "./validateQuery.ts";

export class Api<
  const A extends RouteMap,
> {
  constructor(
    readonly api: A,
  ) {}

  serve = async (request: Request): Promise<Response> => {
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
      const route = this.api[key];
      const subUrl = new URL(url);
      subUrl.pathname = (match.groups?.rest)!;
      const subRequest = new Request(subUrl, request);
      if (route instanceof Api) {
        return await route.serve(subRequest);
      }
      if (!match.groups?.rest) {
        const endpoint = route[request.method as Method];
        if (endpoint == null) {
          return new Response("Method not allowed", { status: 405 });
        }
        return await endpoint.handle(subRequest);
      }
    }
    return new Response("Not found", { status: 404 });
  };
}

export type RouteMap = {
  [path: string]: Endpoint | Api<any>;
};

export type Endpoint = {
  GET?: Route<QuerySchema, void>;
  POST?: Route<QuerySchema, BodySchema>;
  PUT?: Route<QuerySchema, BodySchema>;
  PATCH?: Route<QuerySchema, BodySchema>;
  DELETE?: Route<QuerySchema, void>;
};

export type Method = keyof Endpoint;
