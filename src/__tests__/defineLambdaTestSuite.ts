import { ApolloServer, ApolloServerOptions, BaseContext } from '@apollo/server';
import {
  CreateServerForIntegrationTestsOptions,
  defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import type { Handler } from 'aws-lambda';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { startServerAndCreateLambdaHandler } from '..';
import { urlForHttpServer } from './mockServer';

export function defineLambdaTestSuite<Event, Response>(
  mockServerFactory: (
    handler: Handler<Event, Response>,
    shouldBase64Encode: boolean,
  ) => (req: IncomingMessage, res: ServerResponse) => void,
) {
  describe.each([true, false])(
    'With base64 encoding set to %s',
    (shouldBase64Encode) => {
      defineIntegrationTestSuite(
        async function (
          serverOptions: ApolloServerOptions<BaseContext>,
          testOptions?: CreateServerForIntegrationTestsOptions,
        ) {
          const httpServer = createServer();
          const server = new ApolloServer({
            ...serverOptions,
          });

          const handler = startServerAndCreateLambdaHandler(
            server,
            testOptions,
          );

          httpServer.addListener(
            'request',
            mockServerFactory(
              handler as Handler<Event, Response>,
              shouldBase64Encode,
            ),
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
    },
  );
}
