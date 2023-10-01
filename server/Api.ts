import { escape } from "https://deno.land/std@0.203.0/regexp/escape.ts";
import { Endpoint } from "./Endpoint.ts";
import { QuerySchema } from "./query.ts";
import { BodySchema } from "./body.ts";

/**
 * TREST API.
 */
export class Api<
  const A extends RouteMap,
> {
  /**
   * Initialize a new API.
   *
   * @example
   * ```ts
   * const api = new Api({
   *   "hello": {
   *     GET: new Endpoint(
   *       { query: { name: { type: "string" } }, body: null },
   *       async ({ query }) => {
   *         return { status: 200, type: "text/plain", body: `Hello ${query.name}` };
   *       },
   *     ),
   *   },
   * });
   * ```
   */
  constructor(
    readonly api: A,
  ) {}

  /**
   * Handle a standard {@link Request} and return a {@link Response} based on provided API definition.
   *
   * @example
   * ```ts
   * const api = new Api({});
   * Deno.serve(api.serve);
   * ```
   */
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

/**
 * Map of API paths to {@link Route} or a nested {@link Api}.
 */
export type RouteMap = {
  [path: string]: Route | Api<RouteMap>;
};

/**
 * A single API route. It's a map of HTTP methods to {@link Endpoint}.
 */
export type Route = {
  GET?: Endpoint<
    QuerySchema | undefined | null,
    undefined | null
  >;
  POST?: Endpoint<
    QuerySchema | undefined | null,
    BodySchema | undefined | null
  >;
  PUT?: Endpoint<
    QuerySchema | undefined | null,
    BodySchema | undefined | null
  >;
  PATCH?: Endpoint<
    QuerySchema | undefined | null,
    BodySchema | undefined | null
  >;
  DELETE?: Endpoint<
    QuerySchema | undefined | null,
    undefined | null
  >;
};

/**
 * Any supported HTTP method.
 */
export type Method = keyof Route;
