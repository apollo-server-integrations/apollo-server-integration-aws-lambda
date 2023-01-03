import url from 'url';
import type { IncomingMessage } from 'http';
import type { ALBEvent, ALBResult, Handler } from 'aws-lambda';
import { createMockServer } from './mockServer';

export function createMockALBServer(handler: Handler<ALBEvent, ALBResult>, shouldBase64Encode: boolean) {
  return createMockServer(handler, albEventFromRequest(shouldBase64Encode));
}

function albEventFromRequest(shouldBase64Encode: boolean) {
  return function (req: IncomingMessage, body: string): ALBEvent {
    const urlObject = url.parse(req.url || '', false);
    const searchParams = new URLSearchParams(urlObject.search ?? '');
  
    const multiValueQueryStringParameters: ALBEvent['multiValueQueryStringParameters'] =
      {};
  
    for (const [key] of searchParams.entries()) {
      const all = searchParams.getAll(key);
      if (all.length > 1) {
        multiValueQueryStringParameters[key] = all;
      }
    }
  
    return {
      requestContext: {
        elb: {
          targetGroupArn: '...',
        },
      },
      httpMethod: req.method ?? 'GET',
      path: urlObject.pathname ?? '/',
      queryStringParameters: Object.fromEntries(searchParams.entries()),
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([name, value]) => {
          if (Array.isArray(value)) {
            return [name, value.join(',')];
          } else {
            return [name, value];
          }
        }),
      ),
      multiValueQueryStringParameters,
      body: shouldBase64Encode ? Buffer.from(body, 'utf8').toString('base64') : body,
      isBase64Encoded: shouldBase64Encode,
    };
  }
}

