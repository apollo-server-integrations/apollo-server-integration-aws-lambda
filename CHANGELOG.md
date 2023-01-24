# @as-integrations/aws-lambda

## 2.0.0

### Major Changes

- [#67](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/67) [`5669d23`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/5669d237acd426fcb790ea11b1ba6632a6ea28f2) Thanks [@BlenderDude](https://github.com/BlenderDude)! - 

  ## Why Change?

  In the interest of supporting more event types and allowing user-extensibility, the event parsing has been re-architected. The goal with v2.0 is to allow customizability at each step in the event pipeline, leading to a higher level of Lambda event coverage (including 100% custom event requests).

  ## What changed?

  The second parameter introduces a handler that controls parsing and output generation based on the event type you are consuming. We support 3 event types out-of-the-box: APIGatewayProxyV1/V2 and ALB. Additionally, there is a function for creating your own event parsers in case the pre-defined ones are not sufficient.

  This update also introduces middleware, a great way to modify the request on the way in or update the result on the way out.

  ```typescript
  startServerAndCreateLambdaHandler(
    server,
    handlers.createAPIGatewayProxyEventV2RequestHandler(),
    {
      middleware: [
        async (event) => {
          // event updates here
          return async (result) => {
            // result updates here
          };
        },
      ],
    },
  );
  ```

  ## Upgrade Path

  The upgrade from v1.x to v2.0.0 is quite simple, just update your `startServerAndCreateLambdaHandler` with the new request handler parameter. Example:

  ```typescript
  import {
    startServerAndCreateLambdaHandler,
    handlers,
  } from '@as-integrations/aws-lambda';

  export default startServerAndCreateLambdaHandler(
    server,
    handlers.createAPIGatewayProxyEventV2RequestHandler(),
  );
  ```

  The 3 event handlers provided by the package are:

  - `createAPIGatewayProxyEventV2RequestHandler()`
  - `createALBEventRequestHandler()`
  - `createAPIGatewayProxyEventRequestHandler()`

  Each of these have an optional type parameter which you can use to extend the base event. This is useful if you are using Lambda functions with custom authorizers and need additional context in your events.

  Creating your own event parsers is now possible with `handlers.createRequestHandler()`. Creation of custom handlers is documented in the README.

## 1.2.1

### Patch Changes

- [#73](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/73) [`8a1a6f4`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/8a1a6f41db9c1f0b440c417328ae2ef7770e437e) Thanks [@trevor-scheer](https://github.com/trevor-scheer)! - Remove postinstall script which causes issues for non-TS users

## 1.2.0

### Minor Changes

- [#66](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/66) [`cea20ff`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/cea20ff2cb812b7a1f87e862b20fa428eef4e28d) Thanks [@BlenderDude](https://github.com/BlenderDude)! - Added support for base64 encoding

### Patch Changes

- [#57](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/57) [`6da4f62`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/6da4f62d19511b9d904679799465570bbcc65437) Thanks [@renovate](https://github.com/apps/renovate)! - Fixed content-type parsing to ignore charset definition

## 1.1.0

### Minor Changes

- [#40](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/40) [`74666b4`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/74666b46be3ba8a3d83b16eb180844405aedf372) Thanks [@BlenderDude](https://github.com/BlenderDude)! - ALB Event type integration

### Patch Changes

- [#35](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/35) [`636326b`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/636326b80a6c92903f460b52e7fb25f00e6b28bd) Thanks [@BlenderDude](https://github.com/BlenderDude)! - Updated headers to HeaderMap implementation for case normalization

## 1.0.1

### Patch Changes

- [#32](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/32) [`accacb2`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/accacb2fe2ce754ae607ca167365735f3f8a8eda) Thanks [@christiangaetano](https://github.com/christiangaetano)! - Downcase all header keys during normalization

- [#30](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/30) [`39efda1`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/39efda16058a2664438f8113ebf9a13c5aa9df68) Thanks [@christiangaetano](https://github.com/christiangaetano)! - Correctly recognize gateway v1 events

## 1.0.0

### Major Changes

- [#27](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/27) [`2ec397f`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/2ec397f0c9cc49e18d741bb2cc8feae7a7030e0b) Thanks [@trevor-scheer](https://github.com/trevor-scheer)! - Official support for Apollo Server v4.0.0

## 0.1.1

### Patch Changes

- [#20](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/20) [`8ae797f`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/8ae797ff5951e9f50b19226a541efcd66e46fdc3) Thanks [@trevor-scheer](https://github.com/trevor-scheer)! - Update AS dependencies which incorporate a new response shape for supporting incremental delivery (which will not be supported by serverless integrations like this one)

## 0.1.0

### Minor Changes

- [#11](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/pull/11) [`09194e5`](https://github.com/apollo-server-integrations/apollo-server-integration-aws-lambda/commit/09194e546bdda713fcaa0aefb5f4b22c1089e1a9) Thanks [@michael-watson](https://github.com/michael-watson)! - Initial Publish
