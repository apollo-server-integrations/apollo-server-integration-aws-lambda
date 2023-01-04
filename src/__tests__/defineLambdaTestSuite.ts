import { ApolloServer, ApolloServerOptions, BaseContext } from '@apollo/server';
import {
  CreateServerForIntegrationTestsOptions,
  defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import type { RequestHandler } from '../requestHandler';
import { LambdaHandler, startServerAndCreateLambdaHandler } from '..';
import { urlForHttpServer } from './mockServer';
import type { MiddlewareFn } from '../middleware';

export function defineLambdaTestSuite<RH extends RequestHandler<any, any>>(
  options: {
    requestHandler: RH;
    middleware?: Array<MiddlewareFn<RH>>;
  },
  mockServerFactory: (
    handler: LambdaHandler<RH>,
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
            options.requestHandler,
            {
              ...testOptions,
              middleware: options.middleware,
            },
          );

          httpServer.addListener(
            'request',
            mockServerFactory(handler, shouldBase64Encode),
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
