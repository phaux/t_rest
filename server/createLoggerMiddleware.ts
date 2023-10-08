import { Handler } from "../common/Handler.ts";
import { MethodMap } from "./createMethodFilter.ts";
import { createMiddleware } from "./createMiddleware.ts";

export interface LoggerOptions {
  filterStatus?: number[] | ((status: number) => boolean);
  filterMethod?:
    | Array<keyof MethodMap>
    | ((method: keyof MethodMap) => boolean);
}

export function createLoggerMiddleware<
  const H extends Handler,
>(
  handler: H,
  options: LoggerOptions = {},
): H {
  return createMiddleware(handler, async (request, next) => {
    const startDate = Date.now();
    const response = await next();
    const durationMs = Date.now() - startDate;
    const requestPath = new URL(request.url).pathname;
    if (
      (options.filterStatus instanceof Function
        ? options.filterStatus(response.status)
        : Array.isArray(options.filterStatus)
        ? options.filterStatus.includes(response.status)
        : true) &&
      (options.filterMethod instanceof Function
        ? options.filterMethod(request.method as keyof MethodMap)
        : Array.isArray(options.filterMethod)
        ? options.filterMethod.includes(request.method as keyof MethodMap)
        : true)
    ) {
      console.log(
        `${request.method} ${requestPath} -> ` +
          `${response.status} (${durationMs}ms)`,
      );
    }
    return response;
  });
}
