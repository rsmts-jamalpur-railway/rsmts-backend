import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let errorMessage = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (errorResponse) {
      if (typeof errorResponse === 'string') {
        errorMessage = errorResponse;
      } else if (typeof errorResponse === 'object') {
        errorMessage = (errorResponse as any).message || errorMessage;
        errorCode = (errorResponse as any).error || errorCode;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack);
    }

    const responseBody = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
