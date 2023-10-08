import { Handler } from "../common/Handler.ts";

export function createMiddleware<
  const H extends Handler,
>(
  handler: H,
  middleware: (
    request: Request,
    next: () => Promise<Response>,
  ) => Promise<Response>,
): H {
  return (
    (request, info, params) =>
      middleware(request, () => handler(request, info, params))
  ) as H;
}
