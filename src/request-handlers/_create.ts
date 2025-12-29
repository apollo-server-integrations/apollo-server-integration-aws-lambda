import type {
  HeaderMap,
  HTTPGraphQLRequest,
  HTTPGraphQLResponse,
} from '@apollo/server';
import type { awslambda } from '../awslambda';

export interface RequestHandler<EventType, ResultType> {
  fromEvent: (event: EventType) => HTTPGraphQLRequest;
  toSuccessResult: (response: HTTPGraphQLResponse) => ResultType;
  toErrorResult: (error: unknown) => ResultType;
}

export interface StreamRequestHandler<EventType> {
  type: 'stream';
  fromEvent: (event: EventType) => HTTPGraphQLRequest;
  buildHTTPMetadata: (
    response: HTTPGraphQLResponse,
  ) => Promise<awslambda.HttpMetadata>;
  toErrorResult: (error: unknown) => Promise<{
    metadata: awslambda.HttpMetadata;
    body: string;
  }>;
}

export type RequestHandlerEvent<
  T extends RequestHandler<any, any> | StreamRequestHandler<any>,
> = T extends StreamRequestHandler<infer EventType>
  ? EventType
  : T extends RequestHandler<infer EventType, any>
  ? EventType
  : never;

export type RequestHandlerResult<
  T extends RequestHandler<any, any> | StreamRequestHandler<any>,
> = T extends StreamRequestHandler<any>
  ? awslambda.HttpMetadata
  : T extends RequestHandler<any, infer ResultType>
  ? ResultType
  : never;

export type EventParser<EventType> =
  | {
      parseHttpMethod: (event: EventType) => string;
      parseQueryParams: (event: EventType) => string;
      parseHeaders: (event: EventType) => HeaderMap;
      parseBody: (event: EventType, headers: HeaderMap) => string;
    }
  | ((event: EventType) => HTTPGraphQLRequest);

export type ResultGenerator<ResultType> = {
  success: (response: HTTPGraphQLResponse) => ResultType;
  error: (error: unknown) => ResultType;
};

export function createRequestHandler<EventType, ResultType>(
  eventParser: EventParser<EventType>,
  resultGenerator: ResultGenerator<ResultType>,
): RequestHandler<EventType, ResultType> {
  return {
    fromEvent(event) {
      if (typeof eventParser === 'function') {
        return eventParser(event);
      }
      const headers = eventParser.parseHeaders(event);
      return {
        method: eventParser.parseHttpMethod(event),
        headers,
        search: eventParser.parseQueryParams(event),
        body: eventParser.parseBody(event, headers),
      };
    },
    toSuccessResult: resultGenerator.success,
    toErrorResult: resultGenerator.error,
  };
}

export function createStreamRequestHandler<EventType>(
  eventParser: EventParser<EventType>,
): StreamRequestHandler<EventType> {
  return {
    type: 'stream',
    fromEvent(event) {
      if (typeof eventParser === 'function') {
        return eventParser(event);
      }
      const headers = eventParser.parseHeaders(event);
      return {
        method: eventParser.parseHttpMethod(event),
        headers,
        search: eventParser.parseQueryParams(event),
        body: eventParser.parseBody(event, headers),
      };
    },
    buildHTTPMetadata: async (response) => {
      const { headers, status } = response;

      return {
        statusCode: status ?? 200,
        headers: {
          ...Object.fromEntries(headers),
        },
      };
    },
    toErrorResult: async (error) => {
      return {
        metadata: {
          statusCode: 400,
          headers: {},
        },
        body: (error as Error).message,
      };
    },
  };
}

export function isStreamRequestHandler(
  handler: RequestHandler<any, any> | StreamRequestHandler<any>,
): handler is StreamRequestHandler<any> {
  return 'type' in handler && handler.type === 'stream';
}
