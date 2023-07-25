---
'@as-integrations/aws-lambda': minor
---

## Short circuit middleware execution

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
