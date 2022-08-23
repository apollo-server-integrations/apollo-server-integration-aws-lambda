import type {
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
} from '@apollo/server';
// import type { WithRequired } from '@apollo/utils.withrequired';
import type {
  Handler,
  Context,
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyEventV2,
} from 'aws-lambda';
import { handlerFactory } from './handlerFactory';
export interface LambdaContextFunctionArgument {
  event: APIGatewayProxyEventV2;
  context: Context;
}

export interface LambdaHandlerOptions<TContext extends BaseContext> {
  context?: ContextFunction<[LambdaContextFunctionArgument], TContext>;
}

type LambdaV2Handler = Handler<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>;

export const lambdaV2Handler = handlerFactory<LambdaContextFunctionArgument, Parameters<LambdaV2Handler>, ReturnType<LambdaV2Handler>, {}>({
  createHttpRequest(_, event): HTTPGraphQLRequest {
    let parsedBody: object | string | undefined = undefined;
      if (!event.body) {
        // assert there's a query string?
      } else if (event.headers['content-type'] === 'application/json') {
        parsedBody = JSON.parse(event.body);
      } else if (event.headers['content-type'] === 'text/plain') {
        parsedBody = event.body;
      }

    const headers = new Map<string, string>();
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        // Node/Express headers can be an array or a single value. We join
        // multi-valued headers with `, ` just like the Fetch API's `Headers`
        // does. We assume that keys are already lower-cased (as per the Node
        // docs on IncomingMessage.headers) and so we don't bother to lower-case
        // them or combine across multiple keys that would lower-case to the
        // same value.
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    return {
      method: event.requestContext.http.method,
      headers,
      search: event.rawQueryString,
      body: parsedBody,
    };
  },
  getContextFunctionArgument(_, event, context) {
    return {
      event,
      context,
    }
  },
  async formatSuccessfulResponse(_, httpGraphQLResponse) {
    if (httpGraphQLResponse.completeBody === null) {
      throw Error('Incremental delivery not implemented');
    }
    return {
      statusCode: httpGraphQLResponse.status || 200,
      headers: {
        ...Object.fromEntries(httpGraphQLResponse.headers),
        'content-length': Buffer.byteLength(
          httpGraphQLResponse.completeBody,
        ).toString(),
      },
      body: httpGraphQLResponse.completeBody,
    };
  },
  async formatErroneousResponse(_, error) {
    return {
      statusCode: 400,
      body: (error as Error).message,
    }
  },
})
