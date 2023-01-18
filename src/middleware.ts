import type { RequestHandler } from './request-handlers/_create';

type LambdaResponse<ResultType> = (result: ResultType) => Promise<void>;

type LambdaRequest<EventType, ResultType> = (
  event: EventType,
) => Promise<LambdaResponse<ResultType> | void>;

export type MiddlewareFn<RH extends RequestHandler<any, any>> =
  RH extends RequestHandler<infer EventType, infer ResultType>
    ? LambdaRequest<EventType, ResultType>
    : never;
