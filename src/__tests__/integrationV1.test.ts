import { defineLambdaTestSuite } from './defineLambdaTestSuite';
import { createMockV1Server } from './mockAPIGatewayV1Server';

describe('lambdaHandlerV1', () => {
  defineLambdaTestSuite(createMockV1Server)
});
