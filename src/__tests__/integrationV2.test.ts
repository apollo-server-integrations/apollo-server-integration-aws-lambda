import { defineLambdaTestSuite } from './defineLambdaTestSuite';
import { createMockV2Server } from './mockAPIGatewayV2Server';

describe('lambdaHandlerV2', () => {
  defineLambdaTestSuite(createMockV2Server);
});
