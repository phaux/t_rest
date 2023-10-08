import { escape } from "https://deno.land/std@0.203.0/regexp/escape.ts";
import { Handler } from "../common/Handler.ts";
import { unionToIntersection } from "../common/unionToIntersection.ts";

/**
 * Returns a {@link Handler} that routes requests to other {@link Handler}s based on the request path.
 *
 * Takes a map of paths patterns to {@link Handler}s.
 * The path patterns should omit the leading slash.
 * The request path can either match the whole pattern or can have additional path segments.
 *
 * The pattern can contain params in the form of `{param}`.
 * Param patterns match any characters except for a slash.
 * They are extracted and their values are available in descendant handlers.
 *
 * If a request matches then the matched path prefix is removed and the matched {@link Handler} is called with the rest of the path.
 * If the request matched the whole path, the {@link Handler} is called with an empty path (`/`).
 *
 * The first path pattern that matches is used.
 * If no path pattern matches, a 404 response is returned.
 *
 * Provided path definitions are also used to infer valid request paths for the client.
 * If a path's handler contains it's own sub-paths, the paths are joined with a slash automatically.
 */
export function createPathFilter<PM extends { [path: string]: Handler }>(
  pathMap: PM & { [P in keyof PM & string]: Handler<unknown> },
): Handler<
  unionToIntersection<
    {
      [P in keyof PM & string]: PM[P] extends Handler<infer HPM> ? {
          [HP in keyof HPM & string as `${P}${HP extends "" ? "" : `/${HP}`}`]:
            {
              [HM in keyof HPM[HP] & string]: HPM[HP][HM];
            };
        }
        : never;
    }[keyof PM & string]
  >
> {
  return async (request, info, params) => {
    const requestUrl = new URL(request.url);
    const requestPath = requestUrl.pathname;
    for (const [pathPattern, handlePath] of Object.entries(pathMap)) {
      // turn pathPattern into regexp where {param} become capture groups
      const pathRegexp = new RegExp(
        `^/${escape(pathPattern)}(?<_>|/.*)$`
          .replace(
            /\\\{([\w][\w\d]*)\\\}/g,
            (_match, param) => `(?<${param}>[^/]*?)`,
          ),
        "u",
      );
      const pathMatch = pathRegexp.exec(requestPath);
      if (pathMatch == null) continue;
      const subRequestUrl = new URL(requestUrl);
      subRequestUrl.pathname = (pathMatch.groups?._)!;
      const subRequest = new Request(subRequestUrl, request);
      const pathMatchParams = Object.fromEntries(
        Object.entries(pathMatch.groups ?? {})
          .map(([key, value]) => [key, decodeURIComponent(value)]),
      );
      return await handlePath(subRequest, info, {
        ...(params ?? {}),
        ...pathMatchParams,
      });
    }
    return new Response("Not found", { status: 404 });
  };
}

/**
 * Map of request path patterns to {@link Handler}s.
 */
export type PathMap = {
  [path: string]: Handler;
};
