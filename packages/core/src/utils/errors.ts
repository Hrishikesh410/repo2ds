/**
 * Turns anything a `catch` block can receive into a message worth printing.
 *
 * Everything Repo2DS reports about a failure goes through here, including the
 * CLI's own error handler, so it must never throw: a circular object or a thrown
 * string would otherwise replace a useful message with a crash.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > 0 ? error.message : error.name;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}
