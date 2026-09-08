"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Data fetching.
 *
 * A small purpose-built hook rather than a query library: every request in
 * this application is a GET against our own cached API with an immutable
 * response, so the parts of a client cache that earn their weight — mutation
 * invalidation, optimistic updates, background refetch — are all inert here.
 * What is actually needed is request cancellation on parameter change, which
 * is a dozen lines.
 */

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

const responseCache = new Map<string, unknown>();

export function useApi<T>(url: string | null, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: Boolean(url),
  });
  const latest = useRef(0);

  // Both the "no request to make" and "already cached" cases are derivations
  // from the current url, not subscriptions — resolving them during render
  // avoids a wasted pass through a loading state that will never be seen.
  const [resolvedUrl, setResolvedUrl] = useState(url);
  if (url !== resolvedUrl) {
    setResolvedUrl(url);
    if (!url) {
      setState({ data: null, error: null, loading: false });
    } else {
      const hit = responseCache.get(url) as T | undefined;
      setState(
        hit === undefined
          ? { data: null, error: null, loading: true }
          : { data: hit, error: null, loading: false },
      );
    }
  }

  useEffect(() => {
    if (!url) return;
    if (responseCache.has(url)) return;

    const token = ++latest.current;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? `Request failed (${response.status})`);
        }
        return payload.data as T;
      })
      .then((data) => {
        // Ignore a response that a newer request has already superseded.
        if (token !== latest.current) return;
        responseCache.set(url, data);
        if (responseCache.size > 300) {
          const oldest = responseCache.keys().next();
          if (!oldest.done) responseCache.delete(oldest.value);
        }
        setState({ data, error: null, loading: false });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError" || token !== latest.current) return;
        setState({ data: null, error: error.message, loading: false });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  return state;
}

/** Load a static JSON asset once and keep it for the session. */
export function useStaticJson<T>(url: string): T | null {
  const [data, setData] = useState<T | null>(
    () => (responseCache.get(url) as T | undefined) ?? null,
  );
  const [currentUrl, setCurrentUrl] = useState(url);

  if (url !== currentUrl) {
    setCurrentUrl(url);
    const hit = responseCache.get(url) as T | undefined;
    setData(hit ?? null);
  }

  useEffect(() => {
    const cached = responseCache.get(url) as T | undefined;
    if (cached !== undefined) {
      setData(cached);
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((response) => response.json())
      .then((payload: T) => {
        if (cancelled) return;
        responseCache.set(url, payload);
        setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);

  return data;
}

/**
 * Mirror state into the query string so any view in the explorer is a URL
 * that can be shared, bookmarked or cited — which for a data platform is
 * closer to a requirement than a nicety.
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const [state, setState] = useState<T>(defaults);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const params = new URLSearchParams(window.location.search);
    const next = { ...defaults };
    let changed = false;
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const value = params.get(String(key));
      if (value !== null) {
        next[key] = value as T[keyof T];
        changed = true;
      }
    }
    if (changed) setState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch: Partial<T>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value) params.set(key, String(value));
    }
    const search = params.toString();
    const target = search ? `?${search}` : window.location.pathname;
    if (window.location.search !== (search ? `?${search}` : "")) {
      window.history.replaceState(null, "", target);
    }
  }, [state]);

  return [state, update];
}

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
