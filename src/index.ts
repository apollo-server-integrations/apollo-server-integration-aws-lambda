import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
} from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';
import type {
  Handler,
  Context,
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyEventV2,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from 'aws-lambda';
export interface LambdaContextFunctionArgument {
  event: APIGatewayProxyEventV2 | APIGatewayProxyEvent;
  context: Context;
}

export interface LambdaHandlerOptions<TContext extends BaseContext> {
  context?: ContextFunction<[LambdaContextFunctionArgument], TContext>;
}

type LambdaHandler = Handler<
  APIGatewayProxyEventV2 | APIGatewayProxyEvent,
  APIGatewayProxyStructuredResultV2 | APIGatewayProxyResult
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
    debugger;
    try {
      const normalizedEvent = normalizeGatewayEvent(event);

      try {
        const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
          httpGraphQLRequest: normalizedEvent,
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
        debugger;
        throw error;
      }
    } catch (e) {
      debugger;
      return {
        statusCode: 400,
        body: (e as Error).message,
      };
    }
  };
}

interface NormalizedGatewayEvent {
  method: string;
  headers: Map<string, string>;
  search: string;
  body: object | string;
}

function normalizeGatewayEvent(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): NormalizedGatewayEvent {
  const method = isV1Event(event)
    ? event.httpMethod
    : isV2Event(event)
    ? event.requestContext.http.method
    : undefined;

  if (!method) throw new Error('Unknown event type');

  // TODO: restructure this logically
  let parsedBody: object | string = '';
  if (!event.body) {
    // assert there's a query string?
  } else if (event.headers['content-type'] === 'application/json') {
    parsedBody = JSON.parse(event.body);
  } else if (event.headers['content-type'] === 'text/plain') {
    parsedBody = event.body;
  }

  const headers = new Map<string, string>();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const search = isV1Event(event)
    ? Object.entries({
        ...event.queryStringParameters,
        ...event.multiValueQueryStringParameters,
      }).reduce((queryString, next, i) => {
        const delimiter = i === 0 ? '?' : '&';
        const addition = Array.isArray(next[1])
          ? next[1].map((v) => `${next[0]}=${v}`).join('&')
          : `${next[0]}=${next[1]}`;
        return `${queryString}${delimiter}${addition}`;
      }, '')
    : event.rawQueryString;

  return {
    method,
    headers,
    search,
    body: parsedBody,
  };
}

function isV1Event(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): event is APIGatewayProxyEvent {
  return 'httpMethod' in event;
}

function isV2Event(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): event is APIGatewayProxyEventV2 {
  return !isV1Event(event);
}
