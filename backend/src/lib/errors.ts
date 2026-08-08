/** Error carrying the status code the client should see. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

/** The upstream is unreachable, too slow, or unusable. 503 tells the caller to retry. */
export class UpstreamError extends ApiError {
  constructor(
    readonly upstream: string,
    message: string,
    cause?: unknown,
  ) {
    super(503, message, cause);
    this.name = 'UpstreamError';
  }
}

export class NotConfiguredError extends ApiError {
  constructor(upstream: string) {
    super(503, `${upstream} is not configured on this server`);
    this.name = 'NotConfiguredError';
  }
}
