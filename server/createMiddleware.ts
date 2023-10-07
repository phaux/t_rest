import { Handler } from "../common/Handler.ts";

export function createMiddleware<
  const H extends Handler,
>(
  handler: H,
  middleware: (request: Request, next: H) => Promise<Response>,
): H {
  return ((request: Request) => middleware(request, handler)) as H;
}
