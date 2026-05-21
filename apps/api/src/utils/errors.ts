export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, APIError.prototype);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
    };
  }
}

export function createError(statusCode: number, message: string, details?: Record<string, unknown>) {
  return new APIError(statusCode, message, details);
}
