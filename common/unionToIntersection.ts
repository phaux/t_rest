export type unionToIntersection<T> =
  (T extends infer U ? (arg: U) => void : never) extends
    ((arg: infer I) => void) ? I : never;
