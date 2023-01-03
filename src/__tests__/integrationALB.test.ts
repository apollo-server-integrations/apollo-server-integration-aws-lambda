import { createMockALBServer } from './mockALBServer';
import { defineLambdaTestSuite } from './defineLambdaTestSuite';

describe('lambdaHandlerALB', () => {
  defineLambdaTestSuite(createMockALBServer);
});
