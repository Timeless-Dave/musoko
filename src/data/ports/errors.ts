export type GatewayErrorCode = 'forbidden' | 'not_found' | 'invalid' | 'not_configured' | 'not_implemented';

export class GatewayError extends Error {
  constructor(
    public code: GatewayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}
