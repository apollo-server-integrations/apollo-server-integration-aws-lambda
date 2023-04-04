import type { RequestHandler } from './request-handlers/_create';

export type LambdaResponse<ResultType, ContextType = any> = (
  result: ResultType,
  /**
   * GraphQL context can be accessed here
   * @note will be null when middleware called during an error scenario
   */
  context: ContextType | null,
) => Promise<void>;

export type LambdaRequest<EventType, ResultType, ContextType = any> = (
  event: EventType,
) => Promise<LambdaResponse<ResultType, ContextType> | ResultType | void>;

export type MiddlewareFn<
  RH extends RequestHandler<any, any>,
  ContextType = any,
> = RH extends RequestHandler<infer EventType, infer ResultType>
  ? LambdaRequest<EventType, ResultType, ContextType>
  : never;
