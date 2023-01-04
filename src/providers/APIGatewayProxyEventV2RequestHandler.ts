import { HeaderMap } from '@apollo/server';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { createRequestHandler } from '../requestHandler';

export const APIGatewayProxyEventV2RequestHandler = createRequestHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>(
  {
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
  },
  {
    success({ body, headers, status }) {
      if (body.kind !== 'complete') {
        throw new Error('Only complete body type supported');
      }

      return {
        statusCode: status ?? 200,
        headers: {
          ...Object.fromEntries(headers),
          'content-length': Buffer.byteLength(body.string).toString(),
        },
        body: body.string,
      };
    },
    error(error) {
      return {
        statusCode: 400,
        body: (error as Error).message,
      };
    },
  },
);
