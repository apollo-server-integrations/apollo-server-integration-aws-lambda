import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createStreamRequestHandler } from './_create';
import { HeaderMap } from '@apollo/server';

export const createAPIGatewayProxyEventV2StreamRequestHandler = <
  Event extends APIGatewayProxyEventV2 = APIGatewayProxyEventV2,
>() => {
  return createStreamRequestHandler<Event>({
    parseHttpMethod(event) {
      return event.requestContext.http.method;
    },
    parseHeaders(event) {
      const headerMap = new HeaderMap();
      for (const [key, value] of Object.entries(event.headers ?? {})) {
        headerMap.set(key, value ?? '');
      }
      return headerMap;
    },
    parseBody(event, headers) {
      if (event.body) {
        const contentType = headers.get('content-type');
        const parsedBody = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf8')
          : event.body;
        if (contentType?.startsWith('application/json')) {
          return JSON.parse(parsedBody);
        }
        if (contentType?.startsWith('text/plain')) {
          return parsedBody;
        }
      }
      return '';
    },
    parseQueryParams(event) {
      return event.rawQueryString;
    },
  });
};
