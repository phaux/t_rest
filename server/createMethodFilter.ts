import { AnyQuery, Endpoint, Handler, Input } from "../common/Handler.ts";
import { Nullish } from "../common/Nullable.ts";
import { unionToIntersection } from "../common/unionToIntersection.ts";

/**
 * Returns a {@link Handler} that routes requests to other handlers based on the request method.
 *
 * If no handler is found for the request method, a 405 response is returned.
 *
 * Provided method definitions are also used to infer valid request methods for the client.
 */
export function createMethodFilter<MM extends MethodMap>(
  methodMap: MM,
): Handler<
  unionToIntersection<
    {
      [M in keyof MM & string]: MM[M] extends Handler<infer HPM> ? {
          [HP in keyof HPM & string]: {
            [HM in keyof HPM[HP] & M]: HPM[HP][HM];
          };
        }
        : never;
    }[keyof MM & string]
  >
> {
  return async (request, info, params) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }
    const handleMethod = methodMap[request.method as keyof MethodMap];
    if (handleMethod == null) {
      return new Response("Method not allowed", { status: 405 });
    }
    return await handleMethod(request, info, params);
  };
}

/**
 * Map of request methods to {@link Handler}s.
 */
export type MethodMap = {
  GET?: Handler<
    { [path: string]: { [method: string]: Endpoint<Input<AnyQuery, Nullish>> } }
  >;
  POST?: Handler<{ [path: string]: { [method: string]: Endpoint } }>;
  PUT?: Handler<{ [path: string]: { [method: string]: Endpoint } }>;
  PATCH?: Handler<{ [path: string]: { [method: string]: Endpoint } }>;
  DELETE?: Handler<
    { [path: string]: { [method: string]: Endpoint<Input<AnyQuery, Nullish>> } }
  >;
};
