import url from "url";
import type { IncomingMessage } from "http";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Handler,
} from "aws-lambda";
import { createMockServer } from "./mockServer";

export function createMockV2Server(
  handler: Handler<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>,
) {
  return createMockServer(handler, v2EventFromRequest);
}

function v2EventFromRequest(
  req: IncomingMessage,
  body: string,
): APIGatewayProxyEventV2 {
  const urlObject = url.parse(req.url || "", false);
  return {
    body,
    rawQueryString: urlObject.search?.replace(/^\?/, "") ?? "",
    version: "2.0",
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([name, value]) => {
        if (Array.isArray(value)) {
          return [name, value.join(",")];
        } else {
          return [name, value];
        }
      }),
      ),
    routeKey: "$default",
    queryStringParameters: {},
    requestContext: {
      accountId: "347971939225",
      // cspell:ignore bwvllq KHTML
      apiId: "6bwvllq3t2",
      domainName: "6bwvllq3t2.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "6bwvllq3t2",
      http: {
        method: req.method!,
        path: req.url!,
        protocol: "HTTP/1.1",
        sourceIp: "203.123.103.37",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
      },
      requestId: "YuSJQjZfoAMESbg=",
      routeKey: "$default",
      stage: "$default",
      time: "06/Jan/2021:10:55:03 +0000",
      timeEpoch: 1609930503973,
    },
    isBase64Encoded: false,
    rawPath: urlObject.pathname!,
  };
}