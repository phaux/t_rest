import { Nullable } from "./Nullable.ts";
import { BodySchema, bodyType } from "../server/validateBody.ts";
import { QuerySchema, queryType } from "../server/validateQuery.ts";

declare const actualTypeField: unique symbol;
declare const actualInputField: unique symbol;
declare const actualOutputField: unique symbol;

export type Handler<
  I extends Input = Input,
  O extends Output = Output,
> = ((request: Request) => Promise<Response>) & {
  [actualInputField]?: I;
  [actualOutputField]?: O;
};

export type Input<
  P extends string = string,
  M extends string = string,
  Q extends Nullable<queryType<QuerySchema>> = Nullable<queryType<QuerySchema>>,
  B extends Nullable<bodyType<BodySchema>> = Nullable<bodyType<BodySchema>>,
> = {
  path: P;
  method: M;
  query: Q;
  body: B;
};

export type Output<
  B extends bodyType<BodySchema> = bodyType<BodySchema>,
> = {
  status: number;
  body: B;
};
