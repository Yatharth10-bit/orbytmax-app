import AsyncStorage from '@react-native-async-storage/async-storage';

const FALLBACK_API_URL = 'http://192.168.29.211:3001';
const DEFAULT_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const STORAGE_PREFIX = 'orbytmax-api-v1:';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL).replace(/\/$/, '');

type CacheEntry = { data: unknown; expiresAt: number; staleUntil: number };
type ApiGetOptions = { signal?: AbortSignal; ttlMs?: number; staleTtlMs?: number; force?: boolean; persist?: boolean };

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

export type Satellite = {
  id?: string;
  slug: string;
  name: string;
  agency?: string;
  country?: string;
  category?: string;
  missionType?: string;
  shortDescription?: string;
  description?: string;
  launchDate?: string;
  orbitType?: string;
  altitude?: string;
  inclination?: string;
  facts?: string[];
  timeline?: { date: string; title: string }[];
};

export type Position = {
  name: string;
  slug?: string;
  lat: number;
  lon: number;
  alt: number;
  category?: string;
};

export type Pass = {
  name: string;
  slug?: string;
  category?: string;
  start: string;
  maxTime?: string;
  maxElevation?: number;
  durationSec?: number;
  brightness?: string;
  direction?: string;
};

export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const staleTtlMs = options.staleTtlMs ?? ttlMs;
  const now = Date.now();
  const cached = responseCache.get(path);
  if (!options.force && cached?.expiresAt && cached.expiresAt > now) return cached.data as T;

  if (!options.force && options.persist) {
    const stored = await readStoredEntry(path);
    if (stored) {
      responseCache.set(path, stored);
      if (stored.expiresAt > now) return stored.data as T;
      if (stored.staleUntil > now) {
        void apiGet<T>(path, { ...options, force: true, signal: undefined }).catch(() => undefined);
        return stored.data as T;
      }
    }
  }

  const pending = pendingRequests.get(path);
  if (!options.force && pending) return pending as Promise<T>;

  const request = fetchJson<T>(path, options.signal)
    .then((data) => {
      if (ttlMs > 0) {
        const entry = { data, expiresAt: Date.now() + ttlMs, staleUntil: Date.now() + staleTtlMs };
        responseCache.set(path, entry);
        if (options.persist) void AsyncStorage.setItem(`${STORAGE_PREFIX}${path}`, JSON.stringify(entry));
      }
      return data;
    })
    .finally(() => pendingRequests.delete(path));

  pendingRequests.set(path, request);
  return request;
}

async function readStoredEntry(path: string): Promise<CacheEntry | null> {
  try {
    const value = await AsyncStorage.getItem(`${STORAGE_PREFIX}${path}`);
    return value ? JSON.parse(value) as CacheEntry : null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${API_URL}${path}`, { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function prefetchApi(path: string, ttlMs = DEFAULT_TTL_MS, staleTtlMs = ttlMs) {
  void apiGet(path, { ttlMs, staleTtlMs, persist: true }).catch(() => undefined);
}

export function invalidateApi(path: string) {
  responseCache.delete(path);
}

export function readableTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function countdown(value: string) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return 'Now';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `in ${hours}h ${minutes % 60}m`;
}
