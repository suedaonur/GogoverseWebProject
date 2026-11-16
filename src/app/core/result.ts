export type ErrorCode = 'validation' | 'not_found' | 'storage' | 'blocked';

export type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string };

export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function failure<T = never>(code: ErrorCode, message: string): Result<T> {
  return { ok: false, code, message };
}
