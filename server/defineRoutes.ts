import { escape } from "https://deno.land/std@0.203.0/regexp/escape.ts";
import { Handler, Input } from "../common/Handler.ts";

export function defineRoutes<A extends Record<string, Handler>>(
  routeMap: A,
): {
  [P in keyof A & string]: A[P] extends
    Handler<Input<infer HP, infer HM, infer HQ, infer HB>, infer HO>
    ? Handler<Input<`${P}${HP}`, HM, HQ, HB>, HO>
    : never;
}[keyof A & string] {
  return (async (request: Request): Promise<Response> => {
    const requestUrl = new URL(request.url);
    const requestPath = requestUrl.pathname;
    for (const [pathPattern, handlePath] of Object.entries(routeMap)) {
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
      return await handlePath(subRequest) as any;
    }
    return new Response("Not found", { status: 404 }) as any;
  }) as any;
}
