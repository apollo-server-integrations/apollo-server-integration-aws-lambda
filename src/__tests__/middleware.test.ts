import { ApolloServer } from '@apollo/server';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handlers, middleware, startServerAndCreateLambdaHandler } from '..';
import gql from 'graphql-tag';
import { type DocumentNode, print } from 'graphql';

function createEvent(doc: DocumentNode): APIGatewayProxyEventV2 {
  return {
    version: '2',
    headers: {
      'content-type': 'application/json',
    },
    isBase64Encoded: false,
    rawQueryString: '',
    requestContext: {
      http: {
        method: 'POST',
      },
      // Other requestContext properties omitted for brevity
    } as any,
    rawPath: '/',
    routeKey: '/',
    body: JSON.stringify({
      query: print(doc),
    }),
  };
}

const typeDefs = `#graphql
  type Query {
    hello: String
  }
  type Mutation {
    mutateContext: String
  }
`;

const resolvers = {
  Query: {
    hello: () => 'world',
  },
  Mutation: {
    mutateContext: async (
      _root: any,
      _args: any,
      context: { foo: string | null },
    ) => {
      context.foo = 'bar';
      return 'ok';
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

describe('Request mutation', () => {
  it('updates incoming event headers', async () => {
    const event = createEvent(gql`
      query {
        hello
      }
    `);
    const headerAdditions = {
      'x-injected-header': 'foo',
    };
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2RequestHandler(),
      {
        context: async () => {
          return {
            foo: null,
          };
        },
        middleware: [
          async (event) => {
            Object.assign(event.headers, headerAdditions);
          },
        ],
      },
    );
    await lambdaHandler(event, {} as any, () => {});
    for (const [key, value] of Object.entries(headerAdditions)) {
      expect(event.headers[key]).toBe(value);
    }
  });
  it('returns early if middleware returns a result', async () => {
    const event = createEvent(gql`
      query {
        hello
      }
    `);
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2RequestHandler(),
      {
        context: async () => {
          return {
            foo: null,
          };
        },
        middleware: [
          async () => {
            return {
              statusCode: 418,
            };
          },
        ],
      },
    );
    const result = await lambdaHandler(event, {} as any, () => {})!;
    expect(result.statusCode).toBe(418);
  });
});

describe('Response mutation', () => {
  it('adds cookie values to emitted result', async () => {
    const event = createEvent(gql`
      query {
        hello
      }
    `);
    const cookieValue = 'foo=bar';
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2RequestHandler(),
      {
        context: async () => {
          return {
            foo: null,
          };
        },
        middleware: [
          async () => {
            return async (result) => {
              if (!result.cookies) {
                result.cookies = [];
              }
              result.cookies.push(cookieValue);
            };
          },
        ],
      },
    );
    const result = await lambdaHandler(event, {} as any, () => {})!;
    expect(result.cookies).toContain(cookieValue);
  });
});

describe('runMiddleware', () => {
  const mockHandler: handlers.RequestHandler<any, any> = {
    fromEvent: jest.fn(),
    toSuccessResult: jest.fn(),
    toErrorResult: jest
      .fn()
      .mockReturnValue({ statusCode: 500, body: 'internal error' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns continue with empty middleware list', async () => {
    const result = await middleware.runMiddleware({}, [], mockHandler);
    expect(result.status).toBe('continue');
    if (result.status === 'continue') {
      expect(result.middleware).toEqual([]);
    }
  });

  it('collects result-callback middleware into the continue result', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);
    const result = await middleware.runMiddleware(
      {},
      [async () => callback],
      mockHandler,
    );
    expect(result.status).toBe('continue');
    if (result.status === 'continue') {
      expect(result.middleware).toHaveLength(1);
      expect(result.middleware[0]).toBe(callback);
    }
  });

  it('returns early result when middleware returns an object', async () => {
    const earlyResult = { statusCode: 418 };
    const result = await middleware.runMiddleware(
      {},
      [async () => earlyResult],
      mockHandler,
    );
    expect(result.status).toBe('result');
    if (result.status === 'result') {
      expect(result.result).toBe(earlyResult);
    }
  });

  it('calls toErrorResult and returns result when middleware throws', async () => {
    const error = new Error('middleware exploded');
    const result = await middleware.runMiddleware(
      {},
      [
        async () => {
          throw error;
        },
      ],
      mockHandler,
    );
    expect(mockHandler.toErrorResult).toHaveBeenCalledWith(error);
    expect(result.status).toBe('result');
    if (result.status === 'result') {
      expect(result.result).toEqual({
        statusCode: 500,
        body: 'internal error',
      });
    }
  });

  it('invokes collected callbacks before returning an error result on throw', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);
    const error = new Error('late throw');
    const result = await middleware.runMiddleware(
      {},
      [
        async () => callback,
        async () => {
          throw error;
        },
      ],
      mockHandler,
    );
    expect(result.status).toBe('result');
    expect(callback).toHaveBeenCalledWith({
      statusCode: 500,
      body: 'internal error',
    });
  });
});
