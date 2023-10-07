import { Handler } from "../common/Handler.ts";
import { initFormData } from "../common/initFormData.ts";
import {
  handlerInput,
  handlerMethod,
  handlerOutput,
  handlerPath,
} from "./handlerTypes.ts";

/**
 * Options for {@link createFetcher}.
 */
export interface CreateFetchOptions {
  /**
   * The base URL of your API.
   *
   * All requests are made relative to this URL, using `new URL(path, baseUrl)`.
   *
   * Should probably end with a slash.
   */
  baseUrl: string | URL;
}

/**
 * Creates a fetcher for your API.
 *
 * Pass type of your {@link Handler} as the type parameter to infer all the API types.
 *
 * @template H The {@link Handler} type.
 */
export function createFetcher<H extends Handler>(
  options: CreateFetchOptions,
) {
  return async <
    P extends handlerPath<H>,
    M extends handlerMethod<H, P>,
  >(
    path: P,
    method: M,
    input: handlerInput<H, P, M>,
  ): Promise<handlerOutput<H, P, M>> => {
    const requestUrl = new URL(path, options.baseUrl);
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
