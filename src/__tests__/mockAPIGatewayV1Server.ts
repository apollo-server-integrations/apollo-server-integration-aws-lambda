import url from 'url';
import type { IncomingMessage } from 'http';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from 'aws-lambda';
import { createMockServer } from './mockServer';

export function createMockV1Server(
  handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult>,
  shouldBase64Encode: boolean,
) {
  return createMockServer(handler, v1EventFromRequest(shouldBase64Encode));
}

function v1EventFromRequest(shouldBase64Encode: boolean) {
  return function (
    req: IncomingMessage,
    body: string,
  ): APIGatewayProxyEvent {
    const urlObject = url.parse(req.url || '', false);
    const searchParams = new URLSearchParams(urlObject.search ?? '');
  
    const multiValueQueryStringParameters: Record<string, string[]> = {};
    for (const [key] of searchParams.entries()) {
      const all = searchParams.getAll(key);
      if (all.length > 1) {
        multiValueQueryStringParameters[key] = all;
      }
    }
  
    // simplify the V1 event down to what our integration actually cares about
    const event: Partial<APIGatewayProxyEvent> = {
      // @ts-expect-error (version actually can exist on v1 events, this seems to be a typing error)
      version: '1.0',
      httpMethod: req.method!,
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([name, value]) => {
          if (Array.isArray(value)) {
            return [name, value.join(',')];
          } else {
            return [name, value];
          }
        }),
      ),
      queryStringParameters: Object.fromEntries(searchParams.entries()),
      body: shouldBase64Encode ? Buffer.from(body, 'utf8').toString('base64') : body,
      isBase64Encoded: shouldBase64Encode,
      multiValueQueryStringParameters,
      multiValueHeaders: {},
    };
  
    return event as APIGatewayProxyEvent;
  }
  
}
