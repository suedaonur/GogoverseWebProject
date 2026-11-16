import { TestBed } from '@angular/core/testing';
import { MemoryStorage } from '../testing/memory-storage.testing';
import { APP_STORAGE, StorageService } from './storage.service';

const KEY = 'gogoverse.web.test.v1';
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

function setup(storage: Storage | null): StorageService {
  TestBed.configureTestingModule({ providers: [{ provide: APP_STORAGE, useValue: storage }] });
  return TestBed.inject(StorageService);
}

describe('StorageService', () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it('should report an empty state when the key does not exist', () => {
    expect(setup(memory).read(KEY, isStringList)).toEqual({ status: 'empty' });
  });

  it('should read valid JSON data', () => {
    memory.setItem(KEY, JSON.stringify(['a', 'b']));
    expect(setup(memory).read(KEY, isStringList)).toEqual({ status: 'ok', value: ['a', 'b'] });
  });

  it('should write data as JSON', () => {
    const service = setup(memory);
    expect(service.write(KEY, ['x'])).toEqual({ ok: true });
    expect(memory.getItem(KEY)).toBe('["x"]');
  });

  it('should report corrupt JSON without throwing and without touching the stored value', () => {
    memory.setItem(KEY, '{bozuk');
    const result = setup(memory).read(KEY, isStringList);
    expect(result.status).toBe('corrupt');
    expect(memory.getItem(KEY)).toBe('{bozuk');
  });

  it('should distinguish corrupt data from missing data', () => {
    memory.setItem(KEY, 'not json');
    const service = setup(memory);
    expect(service.read(KEY, isStringList).status).not.toBe('empty');
    expect(service.read('gogoverse.web.missing', isStringList).status).toBe('empty');
  });

  it('should report data with an unexpected structure as invalid and keep it', () => {
    memory.setItem(KEY, JSON.stringify({ not: 'a list' }));
    expect(setup(memory).read(KEY, isStringList).status).toBe('invalid');
    expect(memory.getItem(KEY)).toBe('{"not":"a list"}');
  });

  it('should handle storage read errors', () => {
    memory.failOnGet = new DOMException('denied', 'SecurityError');
    expect(setup(memory).read(KEY, isStringList).status).toBe('unavailable');
  });

  it('should handle a missing storage object', () => {
    const service = setup(null);
    expect(service.read(KEY, isStringList).status).toBe('unavailable');
    expect(service.write(KEY, [])).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('should report quota and security write failures', () => {
    const service = setup(memory);
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    expect(service.write(KEY, ['x'])).toMatchObject({ ok: false, reason: 'quota' });
    memory.failOnSet = new DOMException('blocked', 'SecurityError');
    expect(service.write(KEY, ['x'])).toMatchObject({ ok: false, reason: 'security' });
    expect(memory.getItem(KEY)).toBeNull();
  });

  it('should report values that cannot be serialized', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(setup(memory).write(KEY, circular)).toMatchObject({ ok: false, reason: 'serialize' });
  });

  it('should remove only the requested key', () => {
    memory.setItem(KEY, '[]');
    memory.setItem('baska.uygulama', 'kalmali');
    const service = setup(memory);
    expect(service.remove(KEY)).toEqual({ ok: true });
    expect(memory.getItem(KEY)).toBeNull();
    expect(memory.getItem('baska.uygulama')).toBe('kalmali');
  });
});
