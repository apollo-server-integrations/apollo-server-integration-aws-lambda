import { ApolloServer, ApolloServerOptions, BaseContext } from '@apollo/server';
import {
  CreateServerForIntegrationTestsOptions,
  defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import type { ALBEvent, ALBResult, Handler } from 'aws-lambda';
import { createServer } from 'http';
import { startServerAndCreateLambdaHandler } from '..';
import { createMockALBServer } from './mockALBServer';
import { urlForHttpServer } from './mockServer';

describe('lambdaHandlerALB', () => {
  defineIntegrationTestSuite(
    async function (
      serverOptions: ApolloServerOptions<BaseContext>,
      testOptions?: CreateServerForIntegrationTestsOptions,
    ) {
      const httpServer = createServer();
      const server = new ApolloServer({
        ...serverOptions,
      });

      const handler = testOptions
        ? startServerAndCreateLambdaHandler(server, testOptions)
        : startServerAndCreateLambdaHandler(server);

      httpServer.addListener(
        'request',
        createMockALBServer(handler as Handler<ALBEvent, ALBResult>),
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
      noIncrementalDelivery: true,
    },
  );
});
