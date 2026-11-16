export class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  failOnSet: Error | null = null;
  failOnGet: Error | null = null;

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    if (this.failOnGet) {
      throw this.failOnGet;
    }
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failOnSet) {
      throw this.failOnSet;
    }
    this.data.set(key, value);
  }
}
