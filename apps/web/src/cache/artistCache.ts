import type { Artist, Track } from '@musicdiscovery/shared';

export interface ArtistDetailsPayload {
  artist: Artist;
  topTracks: Track[];
  relatedArtists: Artist[];
  fetchedAt: number;
  provider: string;
}

export interface CachedEntry {
  key: string;
  version: number;
  ttlMs: number;
  value: ArtistDetailsPayload;
  lastAccessedAt: number;
}

export const STORAGE_KEY = 'artistDetailsCache.v1';
export const SCHEMA_VERSION = 1;
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_ENTRIES = 200;

const memory = new Map<string, CachedEntry>();
const inflight = new Map<string, Promise<unknown>>();

const getNow = () => Date.now();

type PersistShape = {
  version: number;
  entries: CachedEntry[];
};

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (storage) {
      return storage;
    }
  }
  return null;
}

function persist(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const entries = Array.from(memory.values());
    const payload: PersistShape = { version: SCHEMA_VERSION, entries };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist artist cache', error);
  }
}

function enforceCapacity(): boolean {
  if (memory.size <= MAX_ENTRIES) {
    return false;
  }
  const items = Array.from(memory.values()).sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  const overflow = Math.max(0, items.length - MAX_ENTRIES);
  for (let index = 0; index < overflow; index += 1) {
    memory.delete(items[index].key);
  }
  return overflow > 0;
}

function normalizeEntry(entry: CachedEntry): CachedEntry | null {
  if (!entry || typeof entry.key !== 'string' || !entry.value) {
    return null;
  }
  const ttlMs = typeof entry.ttlMs === 'number' && entry.ttlMs > 0 ? entry.ttlMs : DEFAULT_TTL_MS;
  const lastAccessedAt =
    typeof entry.lastAccessedAt === 'number' && Number.isFinite(entry.lastAccessedAt)
      ? entry.lastAccessedAt
      : entry.value.fetchedAt ?? getNow();
  const value = {
    ...entry.value,
    fetchedAt:
      typeof entry.value.fetchedAt === 'number' && Number.isFinite(entry.value.fetchedAt)
        ? entry.value.fetchedAt
        : getNow()
  } satisfies ArtistDetailsPayload;
  return {
    key: entry.key,
    version: SCHEMA_VERSION,
    ttlMs,
    value,
    lastAccessedAt
  };
}

function loadFromStorage(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistShape | null;
    if (!parsed || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    let mutated = false;
    for (const entry of parsed.entries) {
      const normalized = normalizeEntry(entry);
      if (!normalized) {
        mutated = true;
        continue;
      }
      memory.set(normalized.key, normalized);
    }
    if (enforceCapacity()) {
      mutated = true;
    }
    if (mutated) {
      persist();
    }
  } catch (error) {
    console.warn('Failed to hydrate artist cache', error);
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

loadFromStorage();

export function makeKey(provider: string, artistId: string): string {
  return `${provider}:${artistId}`;
}

export function isFresh(entry: CachedEntry): boolean {
  return getNow() - entry.value.fetchedAt <= entry.ttlMs;
}

export function markAccessed(key: string): void {
  const entry = memory.get(key);
  if (!entry) return;
  entry.lastAccessedAt = getNow();
  persist();
}

export function getCached(key: string): ArtistDetailsPayload | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (!isFresh(entry)) {
    return null;
  }
  markAccessed(key);
  return entry.value;
}

export function getCachedStale(key: string): ArtistDetailsPayload | null {
  const entry = memory.get(key);
  if (!entry) return null;
  markAccessed(key);
  return entry.value;
}

export function setCached(key: string, payload: ArtistDetailsPayload, ttlMs = DEFAULT_TTL_MS): void {
  const now = getNow();
  const entry: CachedEntry = {
    key,
    version: SCHEMA_VERSION,
    ttlMs,
    value: { ...payload, fetchedAt: now },
    lastAccessedAt: now
  };
  memory.set(key, entry);
  enforceCapacity();
  persist();
}

export function withInflight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }
  const promise = Promise.resolve().then(factory);
  const tracked = promise.finally(() => {
    const current = inflight.get(key);
    if (current === tracked) {
      inflight.delete(key);
    }
  });
  inflight.set(key, tracked as Promise<unknown>);
  return tracked;
}

export function clearAll(): void {
  memory.clear();
  inflight.clear();
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {}
}
