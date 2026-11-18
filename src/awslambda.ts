import type { Writable } from 'stream';
import type { Handler, Context } from 'aws-lambda';

const anyGlobal: any = global;

export namespace awslambda {
  export type HttpMetadata = {
    statusCode: number;
    headers: Record<string, string>;
    cookies?: string[];
  };

  export namespace HttpResponseStream {
    export function from(writable: Writable, metadata: HttpMetadata): Writable {
      return anyGlobal.awslambda.HttpResponseStream.from(writable, metadata);
    }
  }

  export type StreamHandler<Event> = (
    event: Event,
    responseStream: Writable,
    context: Context,
  ) => void;

  export function streamifyResponse<Event>(
    handler: StreamHandler<Event>,
  ): Handler<any, any> {
    return anyGlobal.awslambda.streamifyResponse(handler);
  }
}
