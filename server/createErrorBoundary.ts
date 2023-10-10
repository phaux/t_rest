import { Endpoint, Handler, handlerApi, Output } from "../common/Handler.ts";
import { transformOutput } from "./transformOutput.ts";

export function createErrorBoundary<
  H extends Handler,
  const O extends Output,
>(
  handler: H,
  catcher: (error: Error, request: Request) => Promise<O>,
): Handler<
  {
    [HP in keyof handlerApi<H> & string]: {
      [HM in keyof handlerApi<H>[HP]]: handlerApi<H>[HP][HM] extends
        Endpoint<infer EI, infer EO> ? Endpoint<EI, EO | O>
        : handlerApi<H>[HP][HM];
    };
  }
> {
  return async (request, info, params) => {
    try {
      return await handler(request, info, params);
    } catch (error) {
      return transformOutput(await catcher(error, request));
    }
  };
}
