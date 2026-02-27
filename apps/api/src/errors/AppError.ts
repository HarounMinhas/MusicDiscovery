export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    };
  }
}

export class HttpError extends AppError {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, status, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super('validation_error', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(
    resource: string,
    identifier?: string
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super('not_found', message, 404, { resource, identifier });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('unauthorized', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('forbidden', message, 403);
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super('rate_limit_exceeded', message, 429, { retryAfter });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    service: string,
    details?: Record<string, unknown>
  ) {
    super(
      'service_unavailable',
      `Service '${service}' is temporarily unavailable`,
      503,
      { service, ...details }
    );
  }
}

export function toErrorResponse(error: AppError) {
  return error.toJSON();
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
