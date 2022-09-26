import { ApolloServer, ApolloServerOptions, BaseContext } from '@apollo/server';
import {
  CreateServerForIntegrationTestsOptions,
  defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import type { Handler } from 'aws-lambda';
import { createServer } from 'http';
import { startServerAndCreateLambdaHandler } from '..';
import { createMockV1Server } from './mockAPIGatewayV1Server';
import { urlForHttpServer } from './mockServer';

describe('lambdaHandlerV1', () => {
  defineIntegrationTestSuite(
    async function (
      serverOptions: ApolloServerOptions<BaseContext>,
      testOptions?: CreateServerForIntegrationTestsOptions,
    ) {
      const httpServer = createServer();
      const server = new ApolloServer({
        ...serverOptions,
      });

      const handler: Handler = testOptions
        ? startServerAndCreateLambdaHandler(server, testOptions)
        : startServerAndCreateLambdaHandler(server);

      httpServer.addListener('request', createMockV1Server(handler));

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
      noIncrementalDelivery: true,
    },
  );
});
