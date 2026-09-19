/**
 * Thrown when a service rejects its input during validation.
 *
 * Consuming projects should map this error to a 400 and treat every other error as a
 * system error, either rethrowing it or turning it into a 500. The distinction keeps
 * internal error messages from reaching the client verbatim.
 *
 * `instanceof` can break across package boundaries, so use `isSmsValidationError` to
 * test for it.
 */
export class SmsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsValidationError';
  }
}

/** Tests for a validation error. Works even when duplicate bundles break `instanceof`. */
export function isSmsValidationError(err: unknown): err is SmsValidationError {
  return err instanceof Error && err.name === 'SmsValidationError';
}
