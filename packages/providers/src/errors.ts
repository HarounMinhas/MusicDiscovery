export class ProviderNotImplementedError extends Error {
  public readonly providerId: string;

  constructor(providerId: string) {
    super(`Provider "${providerId}" is not implemented`);
    this.name = 'ProviderNotImplementedError';
    this.providerId = providerId;
  }
}
