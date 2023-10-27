# `@as-integrations/aws-lambda`

## Getting started

Apollo Server runs as a part of your Lambda handler, processing GraphQL requests. This package allows you to easily integrate Apollo Server with AWS Lambda. This integration comes with built-in request handling functionality for ProxyV1, ProxyV2, and ALB events [with extensible typing](#event-extensions). You can also create your own integrations via a [Custom Handler](#custom-request-handlers) and submitted as a PR if others might find them valuable.

First, install Apollo Server, graphql-js, and the Lambda handler package:

```bash
npm install @apollo/server graphql @as-integrations/aws-lambda
```

Then, write the following to `server.mjs`. (By using the .mjs extension, Node treats the file as a module, allowing us to use ESM `import` syntax.)

```js
import { ApolloServer } from '@apollo/server';
import {
  startServerAndCreateLambdaHandler,
  handlers,
} from '@as-integrations/aws-lambda';

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    hello: String!
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    hello: () => 'world',
  },
};

// Set up Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

export default startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
);
```

## Context

As with all Apollo Server 4 integrations, the context resolution is done in the integration. For the Lambda integration, it will look like the following:

```ts
import { ApolloServer } from '@apollo/server';
import {
  startServerAndCreateLambdaHandler,
  handlers,
} from '@as-integrations/aws-lambda';

type ContextValue = {
  isAuthenticated: boolean;
};

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    hello: String!
    isAuthenticated: Boolean!
  }
`;

// Set up Apollo Server
const server = new ApolloServer<ContextValue>({
  typeDefs,
  resolvers: {
    Query: {
      hello: () => 'world',
      isAuthenticated: (root, args, context) => {
        // For context typing to be valid one of the following must be implemented
        //   1. `resolvers` defined inline in the server config (not particularly scalable, but works)
        //   2. Add the type in the resolver function. ex. `(root, args, context: ContextValue)`
        //   3. Propagate the type from an outside definition like GraphQL Codegen
        return context.isAuthenticated;
      },
    },
  },
});

export default startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
  {
    context: async ({ event }) => {
      // Do some parsing on the event (parse JWT, cookie, auth header, etc.)
      return {
        isAuthenticated: true,
      };
    },
  },
);
```

## Middleware

For mutating the event before passing off to `@apollo/server` or mutating the result right before returning, middleware can be utilized.

> Note, this middleware is strictly for event and result mutations and should not be used for any GraphQL modification. For that, [plugins](https://www.apollographql.com/docs/apollo-server/builtin-plugins) from `@apollo/server` would be much better suited.

For example, if you need to set cookie headers with a V2 Proxy Result, see the following code example:

```typescript
import {
  startServerAndCreateLambdaHandler,
  handlers,
} from '@as-integrations/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { server } from './server';

async function regenerateCookie(event: APIGatewayProxyEventV2) {
  // ...
  return 'NEW_COOKIE';
}

export default startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
  {
    middleware: [
      // Both event and result are intended to be mutable
      async (event) => {
        const cookie = await regenerateCookie(event);
        return (result) => {
          result.cookies.push(cookie);
        };
      },
    ],
  },
);
```

### Middleware Typing

If you want to define strictly typed middleware outside of the middleware array, the easiest way would be to extract your request handler into a variable and utilize the `typeof` keyword from Typescript. You could also manually use the `RequestHandler` type and fill in the event and result values yourself.

```typescript
import {
  startServerAndCreateLambdaHandler,
  middleware,
  handlers,
} from '@as-integrations/aws-lambda';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { server } from './server';

const requestHandler = handlers.createAPIGatewayProxyEventV2RequestHandler();

// Utilizing typeof
const cookieMiddleware: middleware.MiddlewareFn<typeof requestHandler> = (
  event,
) => {
  // ...
  return (result) => {
    // ...
  };
};

// Manual event filling
const otherMiddleware: middleware.MiddlewareFn<
  RequestHandler<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>
> = (event) => {
  // ...
  return (result) => {
    // ...
  };
};

export default startServerAndCreateLambdaHandler(server, requestHandler, {
  middleware: [
    // cookieMiddleware will always work here as its signature is
    // tied to the `requestHandler` above
    cookieMiddleware,

    // otherMiddleware will error if the event and result types do
    // not sufficiently overlap, meaning it is your responsibility
    // to keep the event types in sync, but the compiler may help
    otherMiddleware,
  ],
});
```

### Middleware Short Circuit

In some situations, a middleware function might require the execution end before reaching Apollo Server. This might be a global auth guard or session token lookup.

To achieve this, the request middleware function accepts `ResultType` or `Promise<ResultType>` as a return type. Should middleware resolve to such a value, that result is returned and no further execution occurs.

```typescript
import {
  startServerAndCreateLambdaHandler,
  middleware,
  handlers,
} from '@as-integrations/aws-lambda';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { server } from './server';

const requestHandler = handlers.createAPIGatewayProxyEventV2RequestHandler();

// Utilizing typeof
const sessionMiddleware: middleware.MiddlewareFn<typeof requestHandler> = (
  event,
) => {
  // ... check session
  if (!event.headers['X-Session-Key']) {
    // If header doesn't exist, return early
    return {
      statusCode: 401
      body: 'Unauthorized'
    }
  }
};

export default startServerAndCreateLambdaHandler(server, requestHandler, {
  middleware: [
    sessionMiddleware,
  ],
});
```

## Event Extensions

Each of the provided request handler factories has a generic for you to pass a manually extended event type if you have custom authorizers, or if the event type you need has a generic you must pass yourself. For example, here is a request that allows access to the lambda authorizer:

```typescript
import {
  startServerAndCreateLambdaHandler,
  middleware,
  handlers,
} from '@as-integrations/aws-lambda';
import type { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda';
import { server } from './server';

export default startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler<
    APIGatewayProxyEventV2WithLambdaAuthorizer<{
      myAuthorizerContext: string;
    }>
  >(), // This event will also be applied to the MiddlewareFn type
);
```

## Custom Request Handlers

When invoking a lambda manually, or when using an event source we don't currently support (feel free to create a PR), a custom request handler might be necessary. A request handler is created using the `handlers.createHandler` function which takes two function arguments `eventParser` and `resultGenerator`, and two type arguments `EventType` and `ResultType`.

### `eventParser` Argument

There are two type signatures available for parsing events:

#### Method A: Helper Object

This helper object has 4 properties that will complete a full parsing chain, and abstracts some of the work required to coerce the incoming event into a `HTTPGraphQLRequest`. This is the recommended way of parsing events.

##### `parseHttpMethod(event: EventType): string`

Returns the HTTP verb from the request.

Example return value: `GET`

##### `parseQueryParams(event: EventType): string`

Returns the raw query param string from the request. If the request comes in as a pre-mapped type, you may need to use `URLSearchParams` to re-stringify it.

Example return value: `foo=1&bar=2`

##### `parseHeaders(event: EventType): HeaderMap`

Import from here: `import {HeaderMap} from "@apollo/server"`;

Return an Apollo Server header map from the event. `HeaderMap` automatically normalizes casing for you.

##### `parseBody(event: EventType, headers: HeaderMap): string`

Return a plaintext body. Be sure to parse out any base64 or charset encoding. Headers are provided here for convenience as some body parsing might be dependent on `content-type`

#### Method B: Parser Function

If the helper object is too restrictive for your use-case, the other option is to create a function with `(event: EventType): HTTPGraphQLRequest` as the signature. Here you can do any parsing and it is your responsibility to create a valid `HTTPGraphQLRequest`.

### `resultGenerator` Argument

There are two possible result types, `success` and `error`, and they are to be defined as function properties on an object. Middleware will _always_ run, regardless if the generated result was from a success or error. The properties have the following signatures:

##### `success(response: HTTPGraphQLResponse): ResultType`

Given a complete response, generate the desired result type.

##### `error(e: unknown): ResultType`

Given an unknown type error, generate a result. If you want to create a basic parser that captures everything, utilize the instanceof type guard from Typescript.

```typescript
error(e) {
  if(e instanceof Error) {
    return {
      ...
    }
  }
  // If error cannot be determined, panic and use lambda's default error handler
  // Might be advantageous to add extra logging here so unexpected errors can be properly handled later
  throw e;
}
```

### Custom Handler Example

```typescript
import {
  startServerAndCreateLambdaHandler,
  handlers,
} from '@as-integrations/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HeaderMap } from '@apollo/server';
import { server } from './server';

type CustomInvokeEvent = {
  httpMethod: string;
  queryParams: string;
  headers: Record<string, string>;
  body: string;
};

type CustomInvokeResult =
  | {
      success: true;
      body: string;
    }
  | {
      success: false;
      error: string;
    };

const requestHandler = handlers.createRequestHandler<
  CustomInvokeEvent,
  CustomInvokeResult
>(
  {
    parseHttpMethod(event) {
      return event.httpMethod;
    },
    parseHeaders(event) {
      const headerMap = new HeaderMap();
      for (const [key, value] of Object.entries(event.headers)) {
        headerMap.set(key, value);
      }
      return headerMap;
    },
    parseQueryParams(event) {
      return event.queryParams;
    },
    parseBody(event) {
      return event.body;
    },
  },
  {
    success({ body }) {
      return {
        success: true,
        body: body.string,
      };
    },
    error(e) {
      if (e instanceof Error) {
        return {
          success: false,
          error: e.toString(),
        };
      }
      console.error('Unknown error type encountered!', e);
      throw e;
    },
  },
);

export default startServerAndCreateLambdaHandler(server, requestHandler);
```
