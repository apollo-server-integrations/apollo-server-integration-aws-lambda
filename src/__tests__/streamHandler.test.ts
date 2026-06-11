import { Writable } from 'stream';
import { ApolloServer, HeaderMap } from '@apollo/server';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handlers, startServerAndCreateLambdaHandler } from '..';
import gql from 'graphql-tag';
import { type DocumentNode, print } from 'graphql';

function createV2Event(
  doc: DocumentNode,
  options: { isBase64Encoded?: boolean; contentType?: string } = {},
): APIGatewayProxyEventV2 {
  const body = JSON.stringify({ query: print(doc) });
  return {
    version: '2',
    headers: { 'content-type': options.contentType ?? 'application/json' },
    isBase64Encoded: options.isBase64Encoded ?? false,
    rawQueryString: '',
    requestContext: { http: { method: 'POST' } } as any,
    rawPath: '/',
    routeKey: '/',
    body: options.isBase64Encoded ? Buffer.from(body).toString('base64') : body,
  };
}

type CapturedStream = {
  getBody: () => string;
  getMetadata: () =>
    | {
        statusCode: number;
        headers: Record<string, string>;
        cookies?: string[];
      }
    | undefined;
};

function setupAWSLambdaMock(): CapturedStream {
  let capturedMetadata:
    | { statusCode: number; headers: Record<string, string> }
    | undefined;
  const chunks: string[] = [];

  const writable = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });

  (global as any).awslambda = {
    streamifyResponse: (fn: any) => async (event: any, context: any) => {
      await fn(event, writable, context);
    },
    HttpResponseStream: {
      from: (w: any, metadata: any) => {
        capturedMetadata = metadata;
        return w;
      },
    },
  };

  return {
    getBody: () => chunks.join(''),
    getMetadata: () => capturedMetadata,
  };
}

const typeDefs = `#graphql
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello: () => 'world',
  },
};

describe('isStreamRequestHandler', () => {
  it('returns true for a stream handler', () => {
    const h = handlers.createAPIGatewayProxyEventV2StreamRequestHandler();
    expect(handlers.isStreamRequestHandler(h)).toBe(true);
  });

  it('returns false for a regular handler', () => {
    const h = handlers.createAPIGatewayProxyEventV2RequestHandler();
    expect(handlers.isStreamRequestHandler(h)).toBe(false);
  });
});

describe('createStreamRequestHandler', () => {
  const streamHandler =
    handlers.createAPIGatewayProxyEventV2StreamRequestHandler();

  describe('fromEvent', () => {
    it('parses HTTP method, headers, query string, and JSON body', () => {
      const event = createV2Event(gql`
        query {
          hello
        }
      `);
      const req = streamHandler.fromEvent(event);
      expect(req.method).toBe('POST');
      expect(req.headers.get('content-type')).toBe('application/json');
      expect(req.search).toBe('');
      expect((req.body as any).query).toBeDefined();
    });

    it('decodes base64-encoded JSON body', () => {
      const event = createV2Event(
        gql`
          query {
            hello
          }
        `,
        { isBase64Encoded: true },
      );
      const req = streamHandler.fromEvent(event);
      expect((req.body as any).query).toBeDefined();
    });

    it('parses text/plain body as a string', () => {
      const event: APIGatewayProxyEventV2 = {
        ...createV2Event(
          gql`
            query {
              hello
            }
          `,
          { contentType: 'text/plain' },
        ),
        body: '{ hello }',
      };
      const req = streamHandler.fromEvent(event);
      expect(req.body).toBe('{ hello }');
    });

    it('returns empty string for an unknown content type', () => {
      const event: APIGatewayProxyEventV2 = {
        ...createV2Event(
          gql`
            query {
              hello
            }
          `,
          { contentType: 'application/xml' },
        ),
        body: '<data/>',
      };
      const req = streamHandler.fromEvent(event);
      expect(req.body).toBe('');
    });

    it('returns empty string when body is absent', () => {
      const event: APIGatewayProxyEventV2 = {
        ...createV2Event(gql`
          query {
            hello
          }
        `),
        body: undefined,
      };
      const req = streamHandler.fromEvent(event);
      expect(req.body).toBe('');
    });
  });

  describe('buildHTTPMetadata', () => {
    it('maps response status and headers to HttpMetadata', async () => {
      const responseHeaders = new HeaderMap();
      responseHeaders.set('content-type', 'application/json');
      const metadata = await streamHandler.buildHTTPMetadata({
        status: 201,
        headers: responseHeaders,
        body: { kind: 'complete', string: '' },
      } as any);
      expect(metadata.statusCode).toBe(201);
      expect(metadata.headers['content-type']).toBe('application/json');
    });

    it('defaults status to 200 when status is undefined', async () => {
      const metadata = await streamHandler.buildHTTPMetadata({
        status: undefined,
        headers: new HeaderMap(),
        body: { kind: 'complete', string: '' },
      } as any);
      expect(metadata.statusCode).toBe(200);
    });
  });

  describe('toErrorResult', () => {
    it('returns 400 metadata and the error message as body', async () => {
      const result = await streamHandler.toErrorResult(
        new Error('something failed'),
      );
      expect(result.metadata.statusCode).toBe(400);
      expect(result.body).toBe('something failed');
    });
  });
});

describe('Stream Lambda Handler', () => {
  let captured: CapturedStream;

  beforeEach(() => {
    captured = setupAWSLambdaMock();
  });

  afterEach(() => {
    delete (global as any).awslambda;
  });

  it('processes a basic GraphQL query and streams the response', async () => {
    const server = new ApolloServer({ typeDefs, resolvers });
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2StreamRequestHandler(),
    );

    await lambdaHandler(
      createV2Event(gql`
        query {
          hello
        }
      `),
      {} as any,
      () => {},
    );

    expect(captured.getMetadata()?.statusCode).toBe(200);
    expect(JSON.parse(captured.getBody())).toEqual({
      data: { hello: 'world' },
    });
  });

  it('short-circuits and ends the stream when middleware returns metadata', async () => {
    const server = new ApolloServer({ typeDefs, resolvers });
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2StreamRequestHandler(),
      {
        middleware: [async () => ({ statusCode: 401, headers: {} })],
      },
    );

    await lambdaHandler(
      createV2Event(gql`
        query {
          hello
        }
      `),
      {} as any,
      () => {},
    );

    expect(captured.getMetadata()?.statusCode).toBe(401);
    expect(captured.getBody()).toBe('');
  });

  it('writes a 400 error response when event parsing fails', async () => {
    const server = new ApolloServer({ typeDefs, resolvers });
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2StreamRequestHandler(),
    );

    const badEvent: APIGatewayProxyEventV2 = {
      version: '2',
      headers: { 'content-type': 'application/json' },
      isBase64Encoded: false,
      rawQueryString: '',
      requestContext: { http: { method: 'POST' } } as any,
      rawPath: '/',
      routeKey: '/',
      body: 'not-valid-json',
    };

    await lambdaHandler(badEvent, {} as any, () => {});

    expect(captured.getMetadata()?.statusCode).toBe(400);
    expect(captured.getBody()).toContain('JSON');
  });
});
