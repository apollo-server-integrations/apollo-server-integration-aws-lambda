import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
} from '@apollo/server';
import { HeaderMap } from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';
import type {
  ALBEvent,
  ALBResult,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
  Context,
  Handler,
} from 'aws-lambda';

export type IncomingEvent =
  | APIGatewayProxyEvent
  | APIGatewayProxyEventV2
  | ALBEvent;

export type GatewayEvent = IncomingEvent;

export interface LambdaContextFunctionArgument {
  event: IncomingEvent;
  context: Context;
}

export interface LambdaHandlerOptions<TContext extends BaseContext> {
  context?: ContextFunction<[LambdaContextFunctionArgument], TContext>;
}

export type HandlerResult = (
  | APIGatewayProxyStructuredResultV2
  | APIGatewayProxyResult
  | ALBResult
) & {
  statusCode: number;
};

type LambdaHandler = Handler<IncomingEvent, HandlerResult>;

export function startServerAndCreateLambdaHandler(
  server: ApolloServer<BaseContext>,
  options?: LambdaHandlerOptions<BaseContext>,
): LambdaHandler;
export function startServerAndCreateLambdaHandler<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options: WithRequired<LambdaHandlerOptions<TContext>, 'context'>,
): LambdaHandler;
export function startServerAndCreateLambdaHandler<TContext extends BaseContext>(
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

      const { body, headers, status } = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest: normalizedEvent,
        context: () => contextFunction({ event, context }),
      });

      if (body.kind === 'chunked') {
        throw Error('Incremental delivery not implemented');
      }

      return {
        statusCode: status || 200,
        headers: {
          ...Object.fromEntries(headers),
          'content-length': Buffer.byteLength(body.string).toString(),
        },
        body: body.string,
      };
    } catch (e) {
      return {
        statusCode: 400,
        body: (e as Error).message,
      };
    }
  };
}

function normalizeGatewayEvent(event: IncomingEvent): HTTPGraphQLRequest {
  let httpMethod: string;
  if ('httpMethod' in event) {
    httpMethod = event.httpMethod;
  } else {
    httpMethod = event.requestContext.http.method;
  }
  const headers = normalizeHeaders(event.headers);
  let search: string;
  if ('rawQueryString' in event) {
    search = event.rawQueryString;
  } else if ('queryStringParameters' in event) {
    event.queryStringParameters;
    search = normalizeQueryStringParams(
      event.queryStringParameters,
      event.multiValueQueryStringParameters,
    ).toString();
  } else {
    throw new Error('Search params not parsable from event');
  }

  const body = event.body ?? '';

  return {
    method: httpMethod,
    headers,
    search,
    body: parseBody(body, headers.get('content-type')),
  };
}

function parseBody(
  body: string | null | undefined,
  contentType: string | undefined,
): object | string {
  if (body) {
    if (contentType === 'application/json') {
      return JSON.parse(body);
    }
    if (contentType === 'text/plain') {
      return body;
    }
  }
  return '';
}

function normalizeHeaders(headers: IncomingEvent['headers']): HeaderMap {
  const headerMap = new HeaderMap();
  for (const [key, value] of Object.entries(headers ?? {})) {
    headerMap.set(key, value ?? '');
  }
  return headerMap;
}

function normalizeQueryStringParams(
  queryStringParams: Record<string, string | undefined> | null | undefined,
  multiValueQueryStringParameters:
    | Record<string, string[] | undefined>
    | null
    | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryStringParams ?? {})) {
    params.append(key, value ?? '');
  }
  for (const [key, value] of Object.entries(
    multiValueQueryStringParameters ?? {},
  )) {
    for (const v of value ?? []) {
      params.append(key, v);
    }
  }
  return params;
}
