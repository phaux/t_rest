import { Handler, Input } from "../common/Handler.ts";

export function defineMethods<A extends Record<string, Handler>>(
  methodMap: A,
): {
  [M in keyof A & string]: A[M] extends
    Handler<Input<infer HP, infer HM, infer HQ, infer HB>, infer HO>
    ? Handler<Input<HP, M & HM, HQ, HB>, HO>
    : never;
}[keyof A & string] {
  return (async (request: Request): Promise<Response> => {
    const handleMethod = methodMap[request.method];
    if (handleMethod == null) {
      return new Response("Method not allowed", { status: 405 });
    }
    return await handleMethod(request);
  }) as any;
}
