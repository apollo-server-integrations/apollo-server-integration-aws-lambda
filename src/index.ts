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
    try {
      const normalizedEvent = normalizeGatewayEvent(event);

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
    } catch (e) {
      return {
        statusCode: 400,
        body: (e as Error).message,
      };
    }
  };
}

function normalizeGatewayEvent(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): HTTPGraphQLRequest {
  if (isV1Event(event)) {
    return normalizeV1Event(event);
  } else if (isV2Event(event)) {
    return normalizeV2Event(event);
  } else {
    throw Error('Unknown event type');
  }
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

function normalizeV1Event(event: APIGatewayProxyEvent): HTTPGraphQLRequest {
  const headers = normalizeHeaders(event.headers);
  const body = parseBody(event.body, headers.get('content-type'));
  const reconstructedSearchString = Object.entries({
    ...event.queryStringParameters,
    ...event.multiValueQueryStringParameters,
  }).reduce((queryString, next, i) => {
    const delimiter = i === 0 ? '?' : '&';
    const addition = Array.isArray(next[1])
      ? next[1].map((v) => `${next[0]}=${v}`).join('&')
      : `${next[0]}=${next[1]}`;
    return `${queryString}${delimiter}${addition}`;
  }, '');

  return {
    method: event.httpMethod,
    headers,
    search: reconstructedSearchString,
    body,
  };
}

function normalizeV2Event(event: APIGatewayProxyEventV2): HTTPGraphQLRequest {
  const headers = normalizeHeaders(event.headers);
  return {
    method: event.requestContext.http.method,
    headers,
    search: event.rawQueryString,
    body: parseBody(event.body, headers.get('content-type')),
  };
}

function parseBody(
  body: string | null | undefined,
  contentType: string | undefined,
): object | string {
  if (!body) {
    return '';
  } else if (contentType === 'application/json') {
    return JSON.parse(body);
  } else if (contentType === 'text/plain') {
    return body;
  } else {
    return '';
  }
}

function normalizeHeaders(
  headers: Record<string, string | undefined>,
): Map<string, string> {
  const headerMap = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    headerMap.set(key, value ?? '');
  }
  return headerMap;
}
