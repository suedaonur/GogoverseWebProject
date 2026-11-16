import { inject, Injectable, InjectionToken } from '@angular/core';

export const APP_STORAGE = new InjectionToken<Storage | null>('APP_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

export type StorageReadResult<T> =
  | { status: 'empty' }
  | { status: 'ok'; value: T }
  | { status: 'corrupt'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; message: string };

export type StorageWriteResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'quota' | 'security' | 'serialize' | 'unknown'; message: string };

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storage = inject(APP_STORAGE);

  read<T>(key: string, isValid: (value: unknown) => value is T): StorageReadResult<T> {
    if (!this.storage) {
      return { status: 'unavailable', message: 'Tarayıcı depolama alanı kullanılamıyor.' };
    }

    let raw: string | null;
    try {
      raw = this.storage.getItem(key);
    } catch (error) {
      return { status: 'unavailable', message: describeError(error) };
    }

    if (raw === null) {
      return { status: 'empty' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { status: 'corrupt', message: `"${key}" anahtarındaki JSON bozuk: ${describeError(error)}` };
    }

    if (!isValid(parsed)) {
      return { status: 'invalid', message: `"${key}" anahtarındaki veri beklenen yapıda değil.` };
    }
    return { status: 'ok', value: parsed };
  }

  write(key: string, value: unknown): StorageWriteResult {
    if (!this.storage) {
      return { ok: false, reason: 'unavailable', message: 'Tarayıcı depolama alanı kullanılamıyor.' };
    }

    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      return { ok: false, reason: 'serialize', message: describeError(error) };
    }
    if (serialized === undefined) {
      return { ok: false, reason: 'serialize', message: 'Değer JSON olarak yazılamadı.' };
    }

    try {
      this.storage.setItem(key, serialized);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: classifyWriteError(error), message: describeError(error) };
    }
  }

  remove(key: string): StorageWriteResult {
    if (!this.storage) {
      return { ok: false, reason: 'unavailable', message: 'Tarayıcı depolama alanı kullanılamıyor.' };
    }
    try {
      this.storage.removeItem(key);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: classifyWriteError(error), message: describeError(error) };
    }
  }
}

function describeError(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
}

function classifyWriteError(error: unknown): 'quota' | 'security' | 'unknown' {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return 'quota';
  }
  if (name === 'SecurityError') {
    return 'security';
  }
  return 'unknown';
}
