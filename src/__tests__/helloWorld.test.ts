import { helloWorld } from '..';

describe('helloWorld', () => {
  it('says hello', () => {
    expect(helloWorld()).toEqual('Hello World!');
  });
});
