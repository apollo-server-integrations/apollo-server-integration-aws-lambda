import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
} from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
  Context,
  Handler,
} from 'aws-lambda';

export type GatewayEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;

export interface LambdaContextFunctionArgument {
  event: GatewayEvent;
  context: Context;
}

export interface LambdaHandlerOptions<TContext extends BaseContext> {
  context?: ContextFunction<[LambdaContextFunctionArgument], TContext>;
}

type LambdaHandler = Handler<
  GatewayEvent,
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

function normalizeGatewayEvent(event: GatewayEvent): HTTPGraphQLRequest {
  if (isV1Event(event)) {
    return normalizeV1Event(event);
  } else if (isV2Event(event)) {
    return normalizeV2Event(event);
  } else {
    throw Error('Unknown event type');
  }
}

function isV1Event(event: GatewayEvent): event is APIGatewayProxyEvent {
  return !('version' in event);
}

function isV2Event(event: GatewayEvent): event is APIGatewayProxyEventV2 {
  return 'version' in event && event.version === '2.0';
}

function normalizeV1Event(event: APIGatewayProxyEvent): HTTPGraphQLRequest {
  const headers = normalizeHeaders(event.headers);
  const body = parseBody(event.body, headers.get('content-type'));
  // Single value parameters can be directly added
  const searchParams = new URLSearchParams(
    normalizeQueryStringParams(event.queryStringParameters),
  );
  // Passing a key with an array entry to the constructor yields
  // one value in the querystring with %2C as the array was flattened to a string
  // Multi values must be appended individually to get the to-spec output
  for (const [key, values] of Object.entries(event.multiValueQueryStringParameters ?? {})) {
    for (const value of values ?? []) {
      searchParams.append(key, value);
    }
  }

  return {
    method: event.httpMethod,
    headers,
    search: searchParams.toString(),
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
  headers: APIGatewayProxyEventHeaders,
): Map<string, string> {
  const headerMap = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    headerMap.set(key, value ?? '');
  }
  return headerMap;
}

function normalizeQueryStringParams(
  queryStringParams: APIGatewayProxyEventQueryStringParameters | null,
): Record<string, string> {
  const queryStringRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryStringParams ?? {})) {
    queryStringRecord[key] = value ?? '';
  }
  return queryStringRecord;
}
