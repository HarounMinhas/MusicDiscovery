import { describe, expect, it, vi } from 'vitest';

import { clearCache, createCache, withCache } from '../cache.js';

function createStore() {
  return createCache<string>({ max: 50, ttl: 60_000, ttlAutopurge: true });
}

describe('withCache', () => {
  it('returns cached value when entry is still fresh', async () => {
    vi.useFakeTimers();
    const store = createStore();
    const loader = vi.fn().mockResolvedValue('first');

    const initial = await withCache('key', 1_000, loader, store);
    expect(initial).toBe('first');
    expect(loader).toHaveBeenCalledTimes(1);

    const nextLoader = vi.fn().mockResolvedValue('second');
    await vi.advanceTimersByTimeAsync(500);
    const cached = await withCache('key', 1_000, nextLoader, store);

    expect(cached).toBe('first');
    expect(nextLoader).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('refreshes the value once the ttl elapses', async () => {
    const store = createStore();
    const firstLoader = vi.fn().mockResolvedValue('initial');

    await withCache('refresh', 500, firstLoader, store);
    expect(firstLoader).toHaveBeenCalledTimes(1);

    const refreshedLoader = vi.fn().mockResolvedValue('refreshed');
    await new Promise((resolve) => setTimeout(resolve, 600));
    const refreshed = await withCache('refresh', 500, refreshedLoader, store);

    expect(refreshedLoader).toHaveBeenCalledTimes(1);
    expect(refreshed).toBe('refreshed');
  });

  it('evicts the least recently used entry when capacity is exceeded', async () => {
    const store = createCache<string>({ max: 2, ttl: 60_000, ttlAutopurge: true });

    await withCache('a', 10_000, async () => 'a', store);
    await withCache('b', 10_000, async () => 'b', store);

    // Access "a" so that "b" becomes the least recently used entry
    await withCache('a', 10_000, async () => 'new-a', store);

    const loaderC = vi.fn().mockResolvedValue('c');
    await withCache('c', 10_000, loaderC, store);
    expect(loaderC).toHaveBeenCalledTimes(1);

    const loaderB = vi.fn().mockResolvedValue('new-b');
    const valueB = await withCache('b', 10_000, loaderB, store);

    expect(loaderB).toHaveBeenCalledTimes(1);
    expect(valueB).toBe('new-b');
  });

  it('clears entries with clearCache', async () => {
    const store = createStore();
    const loader = vi.fn().mockResolvedValue('value');
    await withCache('clear', 10_000, loader, store);

    clearCache(store);

    const secondLoader = vi.fn().mockResolvedValue('second');
    const result = await withCache('clear', 10_000, secondLoader, store);

    expect(secondLoader).toHaveBeenCalledTimes(1);
    expect(result).toBe('second');
  });
});
