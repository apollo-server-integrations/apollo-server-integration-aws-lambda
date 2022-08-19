import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
} from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';
import type {
  Handler,
  Context,
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyEventV2,
} from 'aws-lambda';
export interface LambdaContextFunctionArgument {
  event: APIGatewayProxyEventV2;
  context: Context;
}

export interface LambdaHandlerOptions<TContext extends BaseContext> {
  context?: ContextFunction<[LambdaContextFunctionArgument], TContext>;
}

type LambdaHandler = Handler<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>;

export function lambdaHandler(
  server: ApolloServer<BaseContext>,
  options?: LambdaHandlerOptions<BaseContext>,
): LambdaHandler;
export function lambdaHandler<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options: WithRequired<LambdaHandlerOptions<TContext>, 'context'>,
): LambdaHandler;
export function lambdaHandler<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options?: LambdaHandlerOptions<TContext>,
): LambdaHandler {
  server.startInBackgroundHandlingStartupErrorsByLoggingAndFailingAllRequests();

  // This `any` is safe because the overload above shows that context can
  // only be left out if you're using BaseContext as your context, and {} is a
  // valid BaseContext.
  const defaultContext: ContextFunction<
    [LambdaContextFunctionArgument],
    any
  > = async () => ({});

  const contextFunction: ContextFunction<
    [LambdaContextFunctionArgument],
    TContext
  > = options?.context ?? defaultContext;

  return async function (event, context) {
    let parsedBody: object | string | undefined = undefined;
    try {
      if (!event.body) {
        // assert there's a query string?
      } else if (event.headers['content-type'] === 'application/json') {
        try {
          parsedBody = JSON.parse(event.body);
        } catch (e: unknown) {
          return {
            statusCode: 400,
            body: (e as Error).message,
          };
        }
      } else if (event.headers['content-type'] === 'text/plain') {
        parsedBody = event.body;
      }
    } catch (error: unknown) {
      // The json body-parser *always* sets req.body to {} if it's unset (even
      // if the Content-Type doesn't match), so if it isn't set, you probably
      // forgot to set up body-parser. (Note that this may change in the future
      // body-parser@2.)
      // return {
      //   statusCode: 500,
      //   body:
      //     '`event.body` is not set; this probably means you forgot to set up the ' +
      //     '`body-parser` middleware before the Apollo Server middleware.',
      // };
      throw error;
    }

    const headers = new Map<string, string>();
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        // Node/Express headers can be an array or a single value. We join
        // multi-valued headers with `, ` just like the Fetch API's `Headers`
        // does. We assume that keys are already lower-cased (as per the Node
        // docs on IncomingMessage.headers) and so we don't bother to lower-case
        // them or combine across multiple keys that would lower-case to the
        // same value.
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    const httpGraphQLRequest: HTTPGraphQLRequest = {
      method: event.requestContext.http.method,
      headers,
      search: event.rawQueryString,
      body: parsedBody,
    };

    try {
      const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest,
        context: () => contextFunction({ event, context }),
      });

      if (httpGraphQLResponse.completeBody === null) {
        throw Error('Incremental delivery not implemented');
      }

      return {
        statusCode: httpGraphQLResponse.status || 200,
        headers: {
          ...Object.fromEntries(httpGraphQLResponse.headers),
          'content-length': Buffer.byteLength(
            httpGraphQLResponse.completeBody,
          ).toString(),
        },
        body: httpGraphQLResponse.completeBody,
      };
    } catch (error) {
      throw error;
    }
  };
}
