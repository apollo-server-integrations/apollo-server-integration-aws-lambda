import type {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
  HTTPGraphQLResponse,
} from '@apollo/server';

export type ServerlessFunctionCallback<ReturnType, OptionsType> = (
  makeGraphQLRequest: (
    request: HTTPGraphQLRequest,
    options: OptionsType,
  ) => Promise<HTTPGraphQLRequest>,
) => ReturnType | Promise<ReturnType>;

export interface ServerlessFunctionOptions<
  ContextArgument,
  TContext extends BaseContext,
> {
  context?: ContextFunction<[ContextArgument], TContext>;
}

export function handlerFactory<
  ContextFunctionArgument,
  HandlerArgs extends any[],
  HandlerReturn,
  TOptions,
>({
  createHttpRequest,
  getContextFunctionArgument,
  formatSuccessfulResponse,
  formatErroneousResponse,
}: {
  createHttpRequest(
    options: TOptions | undefined,
    ...args: HandlerArgs
  ): HTTPGraphQLRequest | Promise<HTTPGraphQLRequest>;
  getContextFunctionArgument(
    options: TOptions | undefined,
    ...args: HandlerArgs
  ): ContextFunctionArgument;
  formatSuccessfulResponse(
    options: TOptions | undefined,
    httpGraphQLResponse: HTTPGraphQLResponse,
  ): HandlerReturn | Promise<HandlerReturn>;
  formatErroneousResponse(
    options: TOptions | undefined,
    error: unknown,
  ): HandlerReturn | Promise<HandlerReturn>;
}) {
  return function <TContext extends BaseContext>(
    server: ApolloServer<TContext>,
    options?: TOptions & {
      context: ContextFunction<[ContextFunctionArgument], any>;
    },
  ) {
    const defaultContext: ContextFunction<
      [ContextFunctionArgument],
      any
    > = async () => ({});

    const contextFunction: ContextFunction<
      [ContextFunctionArgument],
      TContext
    > = options?.context ?? defaultContext;

    server.startInBackgroundHandlingStartupErrorsByLoggingAndFailingAllRequests();

    return async function handler(...args: HandlerArgs) {
      try {
        const httpGraphQLRequest = await createHttpRequest(options, ...args);
        const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
          httpGraphQLRequest,
          context: () =>
            contextFunction(getContextFunctionArgument(options, ...args)),
        });
        return formatSuccessfulResponse(options, httpGraphQLResponse);
      } catch (error) {
        return formatErroneousResponse(options, error);
      }
    };
  };
}
