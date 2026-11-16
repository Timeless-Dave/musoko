export type GatewayErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'not_configured'
  | 'not_implemented'
  /** Too many inquiries from one browser session in an hour. `detail.retryAt` says when to try again. */
  | 'rate_limited'
  /** The spam checks stopped the request: hidden field, form filled too fast, or link spam. */
  | 'spam_suspected';

export interface GatewayErrorDetail {
  /** Field name to a validation code, for the form to show beside the field. */
  fields?: Record<string, string>;
  retryAt?: string;
}

export class GatewayError extends Error {
  constructor(
    public code: GatewayErrorCode,
    message: string,
    public detail: GatewayErrorDetail = {},
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}
