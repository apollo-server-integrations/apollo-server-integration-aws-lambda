import type {
  RequestHandler,
  RequestHandlerEvent,
  RequestHandlerResult,
  StreamRequestHandler,
} from './request-handlers/_create';

export type LambdaResponse<ResultType> = (result: ResultType) => Promise<void>;

export type LambdaRequest<EventType, ResultType> = (
  event: EventType,
) => Promise<LambdaResponse<ResultType> | ResultType | void>;

export type MiddlewareFn<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
> = LambdaRequest<RequestHandlerEvent<RH>, RequestHandlerResult<RH>>;

export async function runMiddleware<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
>(
  event: RequestHandlerEvent<RH>,
  middleware: Array<MiddlewareFn<RH>>,
  handler: RH,
): Promise<
  | {
      status: 'result';
      result: RequestHandlerResult<RH>;
    }
  | {
      status: 'continue';
      middleware: Array<LambdaResponse<RequestHandlerResult<RH>>>;
    }
> {
  const resultMiddlewareFns: Array<LambdaResponse<RequestHandlerResult<RH>>> =
    [];
  try {
    for (const middlewareFn of middleware) {
      const middlewareReturnValue = await middlewareFn(event);
      // If the middleware returns an object, we assume it's a LambdaResponse
      if (
        typeof middlewareReturnValue === 'object' &&
        middlewareReturnValue !== null
      ) {
        return middlewareReturnValue;
      }
      // If the middleware returns a function, we assume it's a result callback
      if (middlewareReturnValue) {
        resultMiddlewareFns.push(middlewareReturnValue);
      }
    }
    return {
      status: 'continue',
      middleware: resultMiddlewareFns,
    };
  } catch (e) {
    const result = handler.toErrorResult(e);

    for (const resultMiddlewareFn of resultMiddlewareFns) {
      await resultMiddlewareFn(result);
    }

    return {
      status: 'result',
      result,
    };
  }
}
