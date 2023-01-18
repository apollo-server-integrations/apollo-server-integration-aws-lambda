import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
} from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';
import type { Context, Handler } from 'aws-lambda';
import type { MiddlewareFn } from './middleware';
import type {
  RequestHandler,
  RequestHandlerEvent,
  RequestHandlerResult,
} from './request-handlers/_create';

export interface LambdaContextFunctionArgument<
  RH extends RequestHandler<any, any>,
> {
  event: RH extends RequestHandler<infer EventType, any> ? EventType : never;
  context: Context;
}

export interface LambdaHandlerOptions<
  RH extends RequestHandler<any, any>,
  TContext extends BaseContext,
> {
  middleware?: Array<MiddlewareFn<RH>>;
  context?: ContextFunction<[LambdaContextFunctionArgument<RH>], TContext>;
}

export type LambdaHandler<RH extends RequestHandler<any, any>> = Handler<
  RequestHandlerEvent<RH>,
  RequestHandlerResult<RH>
>;

export function startServerAndCreateLambdaHandler<
  RH extends RequestHandler<any, any>,
>(
  server: ApolloServer<BaseContext>,
  handler: RH,
  options?: LambdaHandlerOptions<RH, BaseContext>,
): LambdaHandler<RH>;
export function startServerAndCreateLambdaHandler<
  RH extends RequestHandler<any, any>,
  TContext extends BaseContext,
>(
  server: ApolloServer<TContext>,
  handler: RH,
  options: WithRequired<LambdaHandlerOptions<RH, TContext>, 'context'>,
): LambdaHandler<RH>;
export function startServerAndCreateLambdaHandler<
  RH extends RequestHandler<any, any>,
  TContext extends BaseContext,
>(
  server: ApolloServer<TContext>,
  handler: RH,
  options?: LambdaHandlerOptions<RH, TContext>,
): LambdaHandler<RH> {
  server.startInBackgroundHandlingStartupErrorsByLoggingAndFailingAllRequests();

  // This `any` is safe because the overload above shows that context can
  // only be left out if you're using BaseContext as your context, and {} is a
  // valid BaseContext.
  const defaultContext: ContextFunction<
    [LambdaContextFunctionArgument<RH>],
    any
  > = async () => ({});

  const contextFunction: ContextFunction<
    [LambdaContextFunctionArgument<RH>],
    TContext
  > = options?.context ?? defaultContext;

  return async function (event, context) {
    const resultMiddlewareFns: Array<
      (result: RequestHandlerResult<RH>) => Promise<void>
    > = [];
    try {
      for (const middlewareFn of options?.middleware ?? []) {
        const resultCallback = await middlewareFn(event);
        if (resultCallback) {
          resultMiddlewareFns.push(resultCallback);
        }
      }

      const httpGraphQLRequest = handler.fromEvent(event);

      const response = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest,
        context: () => contextFunction({ event, context }),
      });

      const result = handler.toSuccessResult(response);

      for (const resultMiddlewareFn of resultMiddlewareFns) {
        await resultMiddlewareFn(result);
      }

      return result;
    } catch (e) {
      const result = handler.toErrorResult(e);

      for (const resultMiddlewareFn of resultMiddlewareFns) {
        await resultMiddlewareFn(result);
      }

      return result;
    }
  };
}
