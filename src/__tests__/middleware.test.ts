import { ApolloServer } from '@apollo/server';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { handlers, startServerAndCreateLambdaHandler } from '..';
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
          async (event) => {
            event.headers[''];
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
  it('is allowed to access updated context in result middleware', async () => {
    const event = createEvent(gql`
      mutation {
        mutateContext
      }
    `);
    const lambdaHandler = startServerAndCreateLambdaHandler<
      handlers.RequestHandler<
        APIGatewayProxyEventV2,
        APIGatewayProxyStructuredResultV2
      >,
      {
        foo: string | null;
      }
    >(server, handlers.createAPIGatewayProxyEventV2RequestHandler(), {
      context: async () => {
        return {
          foo: 'bar',
        };
      },
      middleware: [
        async () => {
          return async (result, context) => {
            if (!result.cookies) {
              result.cookies = [];
            }
            if (context?.foo) {
              result.cookies.push(`foo=${context?.foo ?? 'UNKNOWN'}`);
            }
          };
        },
      ],
    });
    const result = await lambdaHandler(event, {} as any, () => {})!;
    expect(result.cookies).toContain(`foo=bar`);
  });
});
