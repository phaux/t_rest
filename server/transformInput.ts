import { Input } from "../common/Handler.ts";
import { Nullable, Nullish } from "../common/Nullable.ts";
import { BodySchema, bodyType, validateBody } from "./validateBody.ts";
import { QuerySchema, queryType, validateQuery } from "./validateQuery.ts";

/**
 * Transform {@link Request} into an {@link Input} based on {@link InputSchema}.
 *
 * If the request doesn't match the schema, an error is thrown.
 *
 * @template IS The {@link InputSchema}.
 */
export async function transformInput<IS extends InputSchema>(
  request: Request,
  schema: IS,
): Promise<inputType<IS>> {
  const requestUrl = new URL(request.url);

  let query;
  if (schema.query != null) {
    try {
      query = validateQuery(schema.query, requestUrl.searchParams);
    } catch (error) {
      throw new Error(`Invalid query: ${error.message}`);
    }
  } else {
    query = undefined;
  }

  let body;
  if (schema.body != null) {
    try {
      body = await validateBody(schema.body, request);
    } catch (error) {
      throw new Error(`Invalid body: ${error.message}`);
    }
  } else {
    body = undefined;
  }

  return {
    params: {},
    query: query as inputType<IS>["query"],
    body: body as inputType<IS>["body"],
  };
}
/**
 * Schema describing the {@link Input} of an endpoint.
 *
 * @template QS The {@link QuerySchema}.
 * @template BS The {@link BodySchema}.
 */

export type InputSchema<
  QS extends Nullable<QuerySchema> = Nullable<QuerySchema>,
  BS extends Nullable<BodySchema> = Nullable<BodySchema>,
> =
  & (QS extends object ? { query: QS } : { query?: Nullish })
  & (BS extends object ? { body: BS } : { body?: Nullish });
/**
 * Returns the concrete type of an {@link Input} based on its {@link InputSchema}.
 *
 * @template IS The {@link InputSchema}.
 */

export type inputType<
  IS extends InputSchema,
> = Input<
  IS["query"] extends object ? queryType<IS["query"]> : Nullish,
  IS["body"] extends object ? bodyType<IS["body"]> : Nullish
>;
