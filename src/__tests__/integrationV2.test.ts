import { handlers } from '..';
import { defineLambdaTestSuite } from './defineLambdaTestSuite';
import { createMockV2Server } from './mockAPIGatewayV2Server';

describe('lambdaHandlerV2', () => {
  defineLambdaTestSuite(
    { requestHandler: handlers.createAPIGatewayProxyEventV2RequestHandler() },
    createMockV2Server,
  );
});
