// Re-export from errors/AppError for backward compatibility
export {
  AppError,
  HttpError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ServiceUnavailableError,
  toErrorResponse,
  isAppError
} from './errors/AppError.js';

// Legacy exports for existing code
import { HttpError } from './errors/AppError.js';
export { HttpError as default };
