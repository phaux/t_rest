import { Handler, Input, Output } from "../common/Handler.ts";
import { Nullable, Nullish } from "../common/Nullable.ts";
import { initFormData } from "../common/initFormData.ts";
import { BodySchema, bodyType, validateBody } from "./validateBody.ts";
import { QuerySchema, queryType, validateQuery } from "./validateQuery.ts";

export function defineEndpoint<
  Q extends Nullable<QuerySchema>,
  B extends Nullable<BodySchema>,
  O extends Output = Output,
>(
  schema: { query: Q; body: B },
  handler: (
    input: Input<
      "",
      string,
      Q extends object ? queryType<Q> : Nullish,
      B extends object ? bodyType<B> : Nullish
    >,
  ) => Promise<O>,
): Handler<
  Input<
    "",
    string,
    Q extends object ? queryType<Q> : Nullish,
    B extends object ? bodyType<B> : Nullish
  >,
  O | DefaultOutput
> {
  return async (request) => {
    const url = new URL(request.url);

    let requestQuery: queryType<NonNullable<Q>> | undefined;
    if (schema.query != null) {
      try {
        requestQuery = validateQuery(schema.query, url.searchParams);
      } catch (error) {
        return new Response(`Bad request: Invalid query: ${error.message}`, {
          status: 400,
        });
      }
    } else {
      requestQuery = undefined;
    }

    let requestBody: bodyType<NonNullable<B>> | undefined;
    if (schema.body != null) {
      try {
        requestBody = await validateBody(schema.body, request);
      } catch (error) {
        return new Response(`Bad request: Invalid body: ${error.message}`, {
          status: 400,
        });
      }
    } else {
      requestBody = undefined;
    }

    const response = await handler({
      path: "",
      method: request.method,
      query: requestQuery as Q extends object ? queryType<Q> : undefined | null,
      body: requestBody as B extends object ? bodyType<B> : undefined | null,
    });

    switch (response.body.type) {
      case "text/plain": {
        return new Response(response.body.data, {
          status: response.status,
        });
      }
      case "application/json": {
        return new Response(JSON.stringify(response.body.data), {
          status: response.status,
          headers: { "content-type": "application/json" },
        });
      }
      case "multipart/form-data": {
        return new Response(initFormData(response.body.data), {
          status: response.status,
        });
      }
      default: {
        throw new Error(
          `Unknown response body type ${response.body["type"]}`,
        );
      }
    }
  };
}

export type DefaultOutput = {
  status: 400 | 500;
  body: { type: "text/plain"; data: string };
};
