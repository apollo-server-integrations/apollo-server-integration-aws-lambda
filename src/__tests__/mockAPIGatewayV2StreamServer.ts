import url from 'node:url';
import { Writable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { APIGatewayProxyEventV2, Context as LambdaContext, Handler } from 'aws-lambda';

// Per-invocation state keyed by event object (unique per request).
// Using WeakMaps so concurrent requests don't overwrite each other's state.
const activeWritables = new WeakMap<object, Writable>();
const metadataCallbacks = new WeakMap<
  Writable,
  (metadata: { statusCode: number; headers: Record<string, string> }) => void
>();

// Call this once (e.g. in beforeAll) before startServerAndCreateLambdaHandler
// runs so that awslambda.streamifyResponse is available when the handler is built.
export function installStreamMock() {
  (globalThis as any).awslambda = {
    streamifyResponse: (fn: any) => async (event: any, context: any) => {
      await fn(event, activeWritables.get(event), context);
    },
    HttpResponseStream: {
      from: (w: Writable, metadata: any) => {
        metadataCallbacks.get(w)?.(metadata);
        return w;
      },
    },
  };
}

export function createMockV2StreamServer(
  handler: Handler<APIGatewayProxyEventV2, any>,
  shouldBase64Encode: boolean,
) {
  return (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    // this is an unawaited async function, but anything that causes it to
    // reject should cause a test to fail
    req.on('end', async () => {
      const event = v2EventFromRequest(shouldBase64Encode)(req, body);

      // Pipe Lambda stream writes directly to the HTTP response so incremental
      // delivery chunks reach the client as they are produced.
      const writable = new Writable({
        write(chunk, _enc, cb) {
          res.write(chunk);
          cb();
        },
      });

      // Register per-invocation state using unique objects as WeakMap keys.
      activeWritables.set(event, writable);
      metadataCallbacks.set(writable, (metadata) => {
        res.statusCode = metadata.statusCode ?? 200;
        for (const [key, value] of Object.entries(metadata.headers ?? {})) {
          res.setHeader(key, String(value));
        }
      });

      await handler(
        event,
        { functionName: 'someFunc' } as LambdaContext,
        () => {
          throw new Error("we don't use callback");
        },
      );

      activeWritables.delete(event);
      res.end();
    });
  };
}

function v2EventFromRequest(shouldBase64Encode: boolean) {
  return function (req: IncomingMessage, body: string): APIGatewayProxyEventV2 {
    const urlObject = url.parse(req.url || '', false);

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
      body: shouldBase64Encode
        ? Buffer.from(body, 'utf8').toString('base64')
        : body,
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
          method: req.method,
          path: req.url,
        },
      },
      isBase64Encoded: shouldBase64Encode,
    };
    return event as APIGatewayProxyEventV2;
  };
}
