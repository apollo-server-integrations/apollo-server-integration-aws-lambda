import {
  ApolloServer,
  type ApolloServerOptions,
  type BaseContext,
} from '@apollo/server';
import {
  type CreateServerForIntegrationTestsOptions,
  defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import { createServer } from 'http';
import { handlers, startServerAndCreateLambdaHandler } from '..';
import { urlForHttpServer } from './mockServer';
import {
  createMockV2StreamServer,
  installStreamMock,
} from './mockAPIGatewayV2StreamServer';

describe('lambdaHandlerV2Stream', () => {
  beforeAll(() => {
    // Must run before startServerAndCreateLambdaHandler so that
    // awslambda.streamifyResponse is available at handler-creation time.
    installStreamMock();
  });

  afterAll(() => {
    delete (global as any).awslambda;
  });

  describe.each([true, false])(
    'With base64 encoding set to %s',
    (shouldBase64Encode) => {
      defineIntegrationTestSuite(
        async function (
          serverOptions: ApolloServerOptions<BaseContext>,
          testOptions?: CreateServerForIntegrationTestsOptions,
        ) {
          const httpServer = createServer();
          const server = new ApolloServer({ ...serverOptions });

          const handler = startServerAndCreateLambdaHandler(
            server,
            handlers.createAPIGatewayProxyEventV2StreamRequestHandler(),
            { ...testOptions },
          );

          httpServer.addListener(
            'request',
            createMockV2StreamServer(handler, shouldBase64Encode),
          );

          await new Promise<void>((resolve) => {
            httpServer.listen({ port: 0 }, resolve);
          });

          return {
            server,
            url: urlForHttpServer(httpServer),
            async extraCleanup() {
              await new Promise<void>((resolve) => {
                httpServer.close(() => resolve());
              });
            },
          };
        },
        {
          serverIsStartedInBackground: true,
        },
      );
    },
  );
});
