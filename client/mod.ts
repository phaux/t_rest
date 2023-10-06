import { Handler, Input } from "../common/Handler.ts";
import { initFormData } from "../common/initFormData.ts";

export type handlerPath<H extends Handler> = H extends Handler<Input<infer P>>
  ? P
  : never;

export type handlerMethod<H extends Handler, P extends handlerPath<H>> =
  H extends Handler<Input<P, infer M>> ? M : never;

export type handlerInput<
  H extends Handler,
  P extends handlerPath<H>,
  M extends handlerMethod<H, P>,
> = H extends Handler<Input<P, M, infer Q, infer B>> ? (
    & (Q extends object ? { query: Q } : { query?: undefined | null })
    & (B extends object ? { body: B } : { body?: undefined | null })
  )
  : never;

export type handlerOutput<
  H extends Handler,
  P extends handlerPath<H>,
  M extends handlerMethod<H, P>,
> = H extends Handler<Input<P, M, infer Q, infer B>, infer O> ? O : never;

/**
 * Get the input and output types of an API handler.
 *
 * @template H The API handler type.
 */
export type actualType<H extends Handler> = <
  P extends handlerPath<H>,
  M extends handlerMethod<H, P>,
>(
  path: P,
  method: M,
  input: handlerInput<H, P, M>,
) => Promise<handlerOutput<H, P, M>>;

/**
 * Create a fetcher for your API.
 *
 * Pass type of your API handler as the type parameter to infer all the API types.
 *
 * @template H The API handler type.
 */
export function createFetch<H extends Handler>(baseUrl: string) {
  return async <
    P extends handlerPath<H>,
    M extends handlerMethod<H, P>,
  >(
    path: P,
    method: M,
    input: handlerInput<H, P, M>,
  ): Promise<handlerOutput<H, P, M>> => {
    const requestUrl = new URL(path, baseUrl);
    if (input.query) {
      for (const [paramName, paramValue] of Object.entries(input.query)) {
        requestUrl.searchParams.set(paramName, String(paramValue));
      }
    }
    const request: RequestInit = { method: method };
    if (input.body) {
      switch (input.body.type) {
        case "text/plain": {
          request.body = input.body.data;
          break;
        }
        case "application/json": {
          request.headers = { "content-type": "application/json" };
          request.body = JSON.stringify(input.body.data);
          break;
        }
        case "multipart/form-data": {
          const formData = initFormData(input.body.data);
          request.body = formData;
          break;
        }
      }
    }

    const response = await fetch(requestUrl, request);
    const responseType = response.headers.get("content-type")
      ?.split(";").shift()?.trim().toLowerCase() ?? "text/plain";

    switch (responseType) {
      case "text/plain": {
        return {
          status: response.status,
          body: { type: "text/plain", data: await response.text() },
        } as handlerOutput<H, P, M>;
      }
      case "application/json": {
        return {
          status: response.status,
          body: { type: "application/json", data: await response.json() },
        } as handlerOutput<H, P, M>;
      }
      // TODO: formData
      default: {
        throw new Error(`Unknown response type ${responseType}`);
      }
    }
  };
}
