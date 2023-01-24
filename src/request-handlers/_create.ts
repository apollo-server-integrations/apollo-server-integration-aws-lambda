import type {
  HeaderMap,
  HTTPGraphQLRequest,
  HTTPGraphQLResponse,
} from '@apollo/server';

export interface RequestHandler<EventType, ResultType> {
  fromEvent: (event: EventType) => HTTPGraphQLRequest;
  toSuccessResult: (response: HTTPGraphQLResponse) => ResultType;
  toErrorResult: (error: unknown) => ResultType;
}

export type RequestHandlerEvent<T extends RequestHandler<any, any>> =
  T extends RequestHandler<infer EventType, any> ? EventType : never;

export type RequestHandlerResult<T extends RequestHandler<any, any>> =
  T extends RequestHandler<any, infer ResultType> ? ResultType : never;

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
