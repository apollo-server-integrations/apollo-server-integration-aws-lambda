---
'@as-integrations/aws-lambda': major
---

## Why Change?

In the interest of supporting more event types and allowing user-extensibility, the event parsing has been rearchitected. The goal with v2.0 is to allow customizability at each step in the event pipeline, leading to a higher level of Lambda event coverage (including 100% custom event requests).

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
