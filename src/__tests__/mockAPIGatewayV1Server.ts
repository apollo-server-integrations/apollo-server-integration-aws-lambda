import url from 'url';
import type { IncomingMessage } from 'http';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from 'aws-lambda';
import { createMockServer } from './mockServer';

export function createMockV1Server(
  handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult>,
) {
  return createMockServer(handler, v1EventFromRequest);
}

function v1EventFromRequest(
  req: IncomingMessage,
  body: string,
): APIGatewayProxyEvent {
  const urlObject = url.parse(req.url || '', false);
  const searchParams = new URLSearchParams(urlObject.search ?? '');

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
