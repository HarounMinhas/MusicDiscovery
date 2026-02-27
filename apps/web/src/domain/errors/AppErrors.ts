export class DomainError extends Error {
  readonly code: string;

  constructor(message: string, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class NetworkError extends DomainError {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.status = status;
  }
}

export class ProviderError extends DomainError {
  readonly provider: string;

  constructor(message: string, provider: string) {
    super(message, 'PROVIDER_ERROR');
    this.name = 'ProviderError';
    this.provider = provider;
  }
}
