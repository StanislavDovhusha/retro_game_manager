/**
 * Application errors. Every error carries the HTTP status and a stable machine-readable code, so the central
 * error middleware can build the response without per-route try/catch blocks.
 */

export interface AppErrorOptions {
  /** Extra data for the client (for example the list of invalid fields). Never put secrets here. */
  details?: unknown;
  cause?: unknown;
  /**
   * May the message be shown to the client in production? Client errors (4xx) always may; server errors (5xx)
   * may only when the message was written for the user and contains no internals.
   */
  expose?: boolean;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
  }
}

/** 400: the request is understandable but cannot be done in the current state (for example, no folder selected). */
export class BadRequestError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(400, 'BAD_REQUEST', message, options);
  }
}

/** 400: the input data is invalid. */
export class ValidationError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(400, 'VALIDATION_ERROR', message, options);
  }
}

/** 403: the operation is not allowed (protected system folder, no permission). */
export class ForbiddenError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(403, 'FORBIDDEN', message, options);
  }
}

/**
 * A client-supplied path points outside the allowed root. The status is 400 for a path that is wrong by itself
 * (`..` segments, an absolute path) and 403 when the resolved location (for example through a symlink) escapes.
 */
export class PathTraversalError extends AppError {
  constructor(message: string, options?: AppErrorOptions, status: 400 | 403 = 403) {
    super(status, 'PATH_OUTSIDE_ROOT', message, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(404, 'NOT_FOUND', message, options);
  }
}

/** 409: the request conflicts with the current state (name already taken, operation in progress). */
export class ConflictError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(409, 'CONFLICT', message, options);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(413, 'PAYLOAD_TOO_LARGE', message, options);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message, options);
  }
}

/** 422: the data is well-formed but cannot be processed (for example, an unparsable CSV). */
export class UnprocessableError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(422, 'UNPROCESSABLE', message, options);
  }
}

export class InternalError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(500, 'INTERNAL_ERROR', message, options);
  }
}

export class NotImplementedError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(501, 'NOT_IMPLEMENTED', message, { expose: true, ...options });
  }
}

export class InsufficientStorageError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(507, 'INSUFFICIENT_STORAGE', message, { expose: true, ...options });
  }
}
