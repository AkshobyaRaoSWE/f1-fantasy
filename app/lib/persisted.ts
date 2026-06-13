"use client";

import { useCallback, useSyncExternalStore } from "react";

// A localStorage-backed React state hook.
//
// Reading persisted state on mount used to be done with `useState` +
// `useEffect(() => setState(load()), [])`, but React 19 flags that as a
// set-state-in-effect anti-pattern, and a lazy `useState` initializer would
// cause an SSR hydration mismatch (server has no localStorage). `useSyncExternalStore`
// is the sanctioned solution: it serves a stable server snapshot during SSR and
// transparently swaps in the client value after hydration, no mismatch, no effect.

type Updater<T> = T | ((prev: T) => T);

// getSnapshot must return a referentially-stable value or useSyncExternalStore
// loops forever, so we cache the parsed object and only reparse when the raw
// string actually changes.
const cache = new Map<string, { raw: string | null; value: unknown }>();
const listeners = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function snapshot<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T;
  try {
    value = raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    value = fallback;
  }
  cache.set(key, { raw, value });
  return value;
}

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(fn);
  // Keep tabs/windows in sync when localStorage changes elsewhere.
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) {
      cache.delete(key);
      emit(key);
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePersisted<T>(
  key: string,
  fallback: T,
): [T, (next: Updater<T>) => void] {
  const sub = useCallback((fn: () => void) => subscribe(key, fn), [key]);
  const getSnapshot = useCallback(() => snapshot(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(sub, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: Updater<T>) => {
      const prev = snapshot(key, fallback);
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // ignore quota / private-mode failures
      }
      cache.delete(key);
      emit(key);
    },
    [key, fallback],
  );

  return [value, setValue];
}
