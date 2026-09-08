import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
} from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';
import type { Context, Handler } from 'aws-lambda';
import {
  runMiddleware,
  type LambdaResponse,
  type MiddlewareFn,
} from './middleware';
import {
  isStreamRequestHandler,
  type RequestHandler,
  type RequestHandlerEvent,
  type RequestHandlerResult,
  type StreamRequestHandler,
} from './request-handlers/_create';
import { awslambda } from './awslambda';
import type { Writable } from 'stream';

export interface LambdaContextFunctionArgument<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
> {
  event: RequestHandlerEvent<RH>;
  context: Context;
}

export interface LambdaHandlerOptions<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
  TContext extends BaseContext,
> {
  middleware?: Array<MiddlewareFn<RH>>;
  context?: ContextFunction<[LambdaContextFunctionArgument<RH>], TContext>;
}

export type LambdaHandler<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
> = Handler<RequestHandlerEvent<RH>, RequestHandlerResult<RH>>;

export function startServerAndCreateLambdaHandler<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
>(
  server: ApolloServer<BaseContext>,
  handler: RH,
  options?: LambdaHandlerOptions<RH, BaseContext>,
): LambdaHandler<RH>;
export function startServerAndCreateLambdaHandler<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
  TContext extends BaseContext,
>(
  server: ApolloServer<TContext>,
  handler: RH,
  options: WithRequired<LambdaHandlerOptions<RH, TContext>, 'context'>,
): LambdaHandler<RH>;
export function startServerAndCreateLambdaHandler<
  RH extends RequestHandler<any, any> | StreamRequestHandler<any>,
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

  if (isStreamRequestHandler(handler)) {
    return awslambda.streamifyResponse<RequestHandlerEvent<RH>>(
      async (event, responseStream, context) => {
        let resultMiddlewareFns: Array<
          LambdaResponse<RequestHandlerResult<RH>>
        > = [];
        let httpResponseStream: Writable | undefined;
        try {
          const middlewareResult = await runMiddleware(
            event,
            options?.middleware ?? [],
            handler,
          );
          if (middlewareResult.status === 'result') {
            httpResponseStream = awslambda.HttpResponseStream.from(
              responseStream,
              middlewareResult.result,
            );
            httpResponseStream.end();
            return;
          }
          resultMiddlewareFns = middlewareResult.middleware;

          const httpGraphQLRequest = handler.fromEvent(event);

          const response = await server.executeHTTPGraphQLRequest({
            httpGraphQLRequest,
            context: () => {
              return contextFunction({
                event,
                context,
              });
            },
          });

          const metadata = await handler.buildHTTPMetadata(response);

          httpResponseStream = awslambda.HttpResponseStream.from(
            responseStream,
            metadata,
          );

          if (response.body.kind === 'complete') {
            httpResponseStream.write(response.body.string);
            httpResponseStream.end();
            return;
          }

          for await (const chunk of response.body.asyncIterator) {
            httpResponseStream.write(chunk);
          }
          httpResponseStream.end();
        } catch (e) {
          const { metadata, body } = await handler.toErrorResult(e);

          if (httpResponseStream) {
            httpResponseStream.write(body);
            httpResponseStream.end();
            return;
          }

          for (const resultMiddlewareFn of resultMiddlewareFns) {
            await resultMiddlewareFn(metadata as any);
          }

          httpResponseStream = awslambda.HttpResponseStream.from(
            responseStream,
            metadata,
          );
          httpResponseStream.write(body);
          httpResponseStream.end();
        }
      },
    );
  }

  return async function (event, context) {
    let resultMiddlewareFns: Array<LambdaResponse<RequestHandlerResult<RH>>> =
      [];
    try {
      const middlewareResult = await runMiddleware(
        event,
        options?.middleware ?? [],
        handler,
      );
      if (middlewareResult.status === 'result') {
        return middlewareResult.result;
      }
      resultMiddlewareFns = middlewareResult.middleware;

      const httpGraphQLRequest = handler.fromEvent(event);

      const response = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest,
        context: () => {
          return contextFunction({
            event,
            context,
          });
        },
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
