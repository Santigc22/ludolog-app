export type ErrorDetails = Record<string, unknown> | null;

type ApplicationErrorOptions = Readonly<{
  code: string;
  message: string;
  statusCode: number;
  details?: ErrorDetails;
  cause?: unknown;
}>;

export class ApplicationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: ErrorDetails;

  constructor(options: ApplicationErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ApplicationError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details ?? null;
  }
}
