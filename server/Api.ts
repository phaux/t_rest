import { escape } from "https://deno.land/std@0.203.0/regexp/escape.ts";
import { Endpoint } from "./Endpoint.ts";
import { QuerySchema } from "./query.ts";
import { BodySchema } from "./body.ts";

/**
 * Api definition.
 *
 * Used to define an API and its endpoints.
 * Can also be used to define a nested API.
 *
 * Provided route map will be used to match incoming requests
 * and invoke the corresponding {@link Endpoint}.
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
 *
 * @template A The {@link RouteMap} object containing route definitions.
 */
export class Api<
  A extends RouteMap,
> {
  /**
   * Defines an Api.
   */
  constructor(
    readonly api: A,
  ) {}

  /**
   * Handles a standard {@link Request} and return a {@link Response} based on provided API definition.
   *
   * @example
   * ```ts
   * const api = new Api({});
   * Deno.serve(api.serve);
   * ```
   */
  serve = async (request: Request): Promise<Response> => {
    const requestUrl = new URL(request.url);
    const requestPath = requestUrl.pathname;
    for (const [pathPattern, route] of Object.entries(this.api)) {
      // turn key into regexp where {param} become capture groups
      const pathRegexp = new RegExp(
        `^/${escape(pathPattern)}(?<rest>|/.*)$`
          .replace(
            /\\\{([\w][\w\d]*)\\\}/g,
            (_match, param) => `(?<${param}>[^/]+)`,
          ),
        "u",
      );
      const pathMatch = pathRegexp.exec(requestPath);
      if (pathMatch == null) continue;
      const subRequestUrl = new URL(requestUrl);
      subRequestUrl.pathname = (pathMatch.groups?.rest)!;
      const subRequest = new Request(subRequestUrl, request);
      if (route instanceof Api) {
        return await route.serve(subRequest);
      }
      if (!pathMatch.groups?.rest) {
        const endpoint = route[request.method as keyof Route];
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
