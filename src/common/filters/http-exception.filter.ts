import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: string[];
}

/**
 * Formats every error as `{ success: false, statusCode, message, errors? }`.
 * Validation errors keep their per-field messages in `errors`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorResponse {
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      };
    }

    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : (response as { message?: string | string[] }).message;

    if (Array.isArray(message)) {
      return {
        success: false,
        statusCode,
        message: 'Validation failed',
        errors: message,
      };
    }
    return {
      success: false,
      statusCode,
      message: message ?? exception.message,
    };
  }
}
