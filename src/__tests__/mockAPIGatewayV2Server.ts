import url from 'url';
import type { IncomingMessage } from 'http';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Handler,
} from 'aws-lambda';
import { createMockServer } from './mockServer';

export function createMockV2Server(
  handler: Handler<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>,
) {
  return createMockServer(handler, v2EventFromRequest);
}

function v2EventFromRequest(
  req: IncomingMessage,
  body: string,
): APIGatewayProxyEventV2 {
  const urlObject = url.parse(req.url || '', false);

  // simplify the V2 event down to what our integration actually cares about,
  // but keep it defined in terms of the original type so we know the fields
  // we _are_ populating are correct.
  type TestEventType = Partial<
    Omit<APIGatewayProxyEventV2, 'requestContext'> & {
      requestContext: Partial<
        Omit<APIGatewayProxyEventV2['requestContext'], 'http'> & {
          http: Partial<APIGatewayProxyEventV2['requestContext']['http']>;
        }
      >;
    }
  >;

  const event: TestEventType = {
    version: '2.0',
    body,
    rawQueryString: urlObject.search?.replace(/^\?/, '') ?? '',
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([name, value]) => {
        if (Array.isArray(value)) {
          return [name, value.join(',')];
        } else {
          return [name, value];
        }
      }),
    ),
    requestContext: {
      http: {
        method: req.method!,
        path: req.url!,
      },
    },
  };
  return event as APIGatewayProxyEventV2;
}
