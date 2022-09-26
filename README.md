# `@as-integrations/aws-lambda`

## Getting started: Lambda middleware

Apollo Server runs as a part of your Lambda handler, processing GraphQL requests. This package allows you to easily integrate Apollo Server with AWS Lambda.

First, install Apollo Server, graphql-js, and the Lambda handler package:

```bash
npm install @apollo/server graphql @as-integrations/aws-lambda
```

Then, write the following to `server.mjs`. (By using the .mjs extension, Node treats the file as a module, allowing us to use ESM `import` syntax.)

```js
import { ApolloServer } from "@apollo/server";
import { startServerAndCreateLambdaHandler } from "@as-integrations/aws-lambda";

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    hello: String
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    hello: () => "world",
  },
};

// Set up Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

export default startServerAndCreateLambdaHandler(server);
```