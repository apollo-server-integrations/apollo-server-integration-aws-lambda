import type { RequestHandler } from './request-handlers/_create';

type MaybePromise<T> = Promise<T> | T;

type LambdaResponse<ResultType> = (result: ResultType) => MaybePromise<void>;

type LambdaRequest<EventType, ResultType> = (
  event: EventType,
) => MaybePromise<LambdaResponse<ResultType> | undefined>;

export type MiddlewareFn<RH extends RequestHandler<any, any>> =
  RH extends RequestHandler<infer EventType, infer ResultType>
    ? LambdaRequest<EventType, ResultType>
    : never;
