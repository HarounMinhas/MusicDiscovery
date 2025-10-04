export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
  size(): number;
  getOrSet(key: string, loader: () => Promise<T>): Promise<{ value: T; hit: boolean }>; 
}

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  const store = new Map<string, CacheEntry<T>>();

  function get(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: string, value: T) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async function getOrSet(key: string, loader: () => Promise<T>) {
    const cached = get(key);
    if (cached !== undefined) {
      return { value: cached, hit: true } as const;
    }
    const value = await loader();
    set(key, value);
    return { value, hit: false } as const;
  }

  function clear() {
    store.clear();
  }

  function size() {
    return store.size;
  }

  return { get, set, clear, size, getOrSet };
}
