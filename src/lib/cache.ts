import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "./env";

/**
 * Two-tier cache for upstream climate responses.
 *
 * Climate projections are immutable: a CMIP6 field for 2040–2059 under
 * SSP2-4.5 will read the same next year as it does today. That makes them
 * unusually cache-friendly, and caching hard is what keeps the application
 * responsive despite an upstream API that takes 1–3 seconds per call.
 *
 * Tier 1 is an in-process LRU (fast, lost on restart). Tier 2 is a
 * content-addressed directory on disk (survives restarts and deploys of the
 * same image, and lets `npm run warm` pre-populate a build).
 *
 * Single-flight de-duplication means N concurrent requests for the same field
 * produce one upstream call, which matters when a map view fans out across
 * scenarios.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_MEMORY_ENTRIES = 5_000;

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function touch<T>(key: string, entry: Entry<T>) {
  // Map preserves insertion order, so delete+set moves the key to the newest
  // position — a serviceable LRU without a dependency.
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next();
    if (!oldest.done) memory.delete(oldest.value);
  }
}

function readMemory<T>(key: string): T | undefined {
  const entry = memory.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    memory.delete(key);
    return undefined;
  }
  touch(key, entry);
  return entry.value;
}

function diskPath(key: string): string {
  const digest = createHash("sha256").update(key).digest("hex");
  // Shard by the first two hex characters so no directory grows unbounded.
  return path.join(env.CLIMATE_CACHE_DIR, digest.slice(0, 2), `${digest}.json`);
}

async function readDisk<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await readFile(diskPath(key), "utf8");
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.expiresAt < Date.now()) return undefined;
    touch(key, entry);
    return entry.value;
  } catch {
    return undefined;
  }
}

async function writeDisk<T>(key: string, entry: Entry<T>): Promise<void> {
  const file = diskPath(key);
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(entry), "utf8");
  } catch {
    // A read-only or full filesystem must never fail a request; the memory
    // tier still serves the value for the life of the process.
  }
}

export interface CacheOptions {
  ttlMs?: number;
  /** Skip the disk tier for values that are cheap to recompute. */
  memoryOnly?: boolean;
}

/**
 * Resolve `key`, computing it with `factory` at most once across all
 * concurrent callers.
 */
export async function cached<T>(
  key: string,
  factory: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const hit = readMemory<T>(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const work = (async () => {
    if (!options.memoryOnly) {
      const fromDisk = await readDisk<T>(key);
      if (fromDisk !== undefined) return fromDisk;
    }
    const value = await factory();
    const entry: Entry<T> = {
      value,
      expiresAt: Date.now() + (options.ttlMs ?? DEFAULT_TTL_MS),
    };
    touch(key, entry);
    if (!options.memoryOnly) await writeDisk(key, entry);
    return value;
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}

export function cacheStats() {
  return { memoryEntries: memory.size, inflight: inflight.size };
}

export function clearMemoryCache() {
  memory.clear();
}
