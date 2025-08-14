import crypto from 'crypto'

export function logServerError(scope: string, error: unknown, extra?: Record<string, unknown>): string {
  const id = crypto.randomUUID()
  const payload = {
    error_id: id,
    scope,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...sanitize(extra),
  }
  console.error('[server_error]', JSON.stringify(payload))
  return id
}

function sanitize(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!obj) return obj
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch {
    return obj
  }
}


