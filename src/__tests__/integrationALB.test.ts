import { createMockALBServer } from './mockALBServer';
import { defineLambdaTestSuite } from './defineLambdaTestSuite';
import { ALBEventRequestHandler } from '../providers/ALBEventRequestHandler';

describe('lambdaHandlerALB', () => {
  defineLambdaTestSuite(
    { requestHandler: ALBEventRequestHandler },
    createMockALBServer,
  );
});
