type LogFields = Record<string, unknown>;

function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { detail: err };
}

export const logger = {
  info(message: string, fields?: LogFields): void {
    process.stdout.write(
      `${JSON.stringify({ level: 'info', message, ...fields, ts: new Date().toISOString() })}\n`,
    );
  },
  error(message: string, err?: unknown, fields?: LogFields): void {
    const payload: LogFields = {
      level: 'error',
      message,
      ...fields,
      ts: new Date().toISOString(),
    };
    if (err !== undefined) {
      payload['error'] = serializeError(err);
    }
    process.stderr.write(`${JSON.stringify(payload)}\n`);
  },
};
