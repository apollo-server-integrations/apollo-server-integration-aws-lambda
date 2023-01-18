import { ApolloServer } from '@apollo/server';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handlers, startServerAndCreateLambdaHandler } from '..';

const event: APIGatewayProxyEventV2 = {
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
  body: '{"operationName": null, "variables": null, "query": "{ hello }"}',
};

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

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

describe('Request mutation', () => {
  it('updates incoming event headers', async () => {
    const headerAdditions = {
      'x-injected-header': 'foo',
    };
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2RequestHandler(),
      {
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
});

describe('Response mutation', () => {
  it('adds cookie values to emitted result', async () => {
    const cookieValue = 'foo=bar';
    const lambdaHandler = startServerAndCreateLambdaHandler(
      server,
      handlers.createAPIGatewayProxyEventV2RequestHandler(),
      {
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
