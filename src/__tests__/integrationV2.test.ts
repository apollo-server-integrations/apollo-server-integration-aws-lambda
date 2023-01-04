import { APIGatewayProxyEventV2RequestHandler } from '../providers/APIGatewayProxyEventV2RequestHandler';
import { defineLambdaTestSuite } from './defineLambdaTestSuite';
import { createMockV2Server } from './mockAPIGatewayV2Server';

describe('lambdaHandlerV2', () => {
  defineLambdaTestSuite(
    { requestHandler: APIGatewayProxyEventV2RequestHandler },
    createMockV2Server,
  );
});
