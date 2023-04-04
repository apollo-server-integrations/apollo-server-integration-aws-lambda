---
'@as-integrations/aws-lambda': minor
---

You can now opt to return a Lambda result object directly from the middleware. This will cancel the middleware chain, bypass GraphQL request processing, and immediately return the Lambda result.

Example

```ts
export const handler = startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
  {
    context: async () => {
      return {};
    },
    middleware: [
      async (event) => {
        const psk = Buffer.from('SuperSecretPSK');
        const token = Buffer.from(event.headers['X-Auth-Token']);
        if (
          psk.byteLength !== token.byteLength ||
          crypto.timingSafeEqual(psk, token)
        ) {
          return {
            statusCode: '403',
            body: 'Forbidden',
          };
        }
      },
    ],
  },
);
```

In order to facilitate the resolvers making updates to the resultant lambda response, the server context can be used to pass data back to the result in the middleware.

Example:

```ts
export const handler = startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
  {
    context: async () => {
      return {
        foo: 'bar',
      };
    },
    middleware: [
      async () => {
        return async (result, context) => {
          if (!result.cookies) {
            result.cookies = [];
          }
          if (context?.foo) {
            reuslt.cookies.push(`foo=${context.foo}`);
          }
        };
      },
    ],
  },
);

// Event will have `cookies: ['foo=bar']`
```
