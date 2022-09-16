import url from "url";
import type { IncomingMessage, ServerResponse } from "http";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context as LambdaContext,
  Handler,
} from "aws-lambda";

// Returns a Node http handler that invokes a Lambda handler as if via
// APIGatewayProxy
export function createMockServer(
  handler: Handler,
) {
  return (req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    // this is an unawaited async function, but anything that causes it to
    // reject should cause a test to fail
    req.on("end", async () => {
      const event = eventFromRequest(req, body);
      const result = (await handler(
        event,
        { functionName: "someFunc" } as LambdaContext, // we don't bother with all the fields
        () => {
          throw Error("we don't use callback");
        },
      )) as APIGatewayProxyResult;
      res.statusCode = result.statusCode!;
      Object.entries(result.headers ?? {}).forEach(([key, value]) => {
        res.setHeader(key, value.toString());
      });
      res.write(result.body);
      res.end();
    });
  };
}

function eventFromRequest(
  req: IncomingMessage,
  body: string,
): APIGatewayProxyEvent {
  const urlObject = url.parse(req.url || "", false);
  const searchParams = new URLSearchParams(urlObject.search ?? "")

  const multiValueQueryStringParameters: Record<string, string[]> = {};
  for (const [key] of searchParams.entries()) {
    const all = searchParams.getAll(key);
    if (all.length > 1) {
      multiValueQueryStringParameters[key] = all;
    }
  }

  const event: APIGatewayProxyEvent = {
    httpMethod: req.method!,
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([name, value]) => {
        if (Array.isArray(value)) {
          return [name, value.join(',')];
        } else {
          return [name, value];
        }
      }),
    ),
    queryStringParameters: Object.fromEntries(searchParams.entries()),
    body,
    multiValueQueryStringParameters,
    multiValueHeaders: {},
    path: urlObject.pathname || '',
    pathParameters: {},
    stageVariables: {},
    resource: '',
    requestContext: {
      protocol: '',
      httpMethod: req.method!,
      path: urlObject.pathname!,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '',
        user: null,
        userAgent: null,
        userArn: null,
      },
      resourcePath: '',
      requestTimeEpoch: Date.now(),
      resourceId: '',
      authorizer: undefined,
      accountId: '347971939225',
      // cspell:ignore bwvllq KHTML
      apiId: '6bwvllq3t2',
      domainName: '6bwvllq3t2.execute-api.us-east-1.amazonaws.com',
      domainPrefix: '6bwvllq3t2',
      requestId: 'YuSJQjZfoAMESbg=',
      routeKey: '$default',
      stage: '$default',
    },
    isBase64Encoded: false,
  };
  return event;
}