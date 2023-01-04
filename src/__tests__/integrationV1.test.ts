import { APIGatewayProxyEventRequestHandler } from '../providers/APIGatewayProxyEventRequestHandler';
import { defineLambdaTestSuite } from './defineLambdaTestSuite';
import { createMockV1Server } from './mockAPIGatewayV1Server';

describe('lambdaHandlerV1', () => {
  defineLambdaTestSuite(
    { requestHandler: APIGatewayProxyEventRequestHandler },
    createMockV1Server,
  );
});
