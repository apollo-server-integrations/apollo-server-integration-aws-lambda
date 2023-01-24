import { createMockALBServer } from './mockALBServer';
import { defineLambdaTestSuite } from './defineLambdaTestSuite';
import { handlers } from '..';

describe('lambdaHandlerALB', () => {
  defineLambdaTestSuite(
    { requestHandler: handlers.createALBEventRequestHandler() },
    createMockALBServer,
  );
});
