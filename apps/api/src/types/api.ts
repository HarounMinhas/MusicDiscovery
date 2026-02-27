export interface ApiResponse<T> {
  data?: T;
  meta?: {
    page?: number;
    total?: number;
    cached?: boolean;
    timestamp?: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type ApiHandler<T = unknown> = (
  params: Record<string, unknown>
) => Promise<ApiResponse<T> | ApiError>;
