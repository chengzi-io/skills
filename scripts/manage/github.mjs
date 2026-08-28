import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { log } from '@clack/prompts';
import {
  CACHE_DIR,
  CACHE_TTL_MS,
} from './workspace.mjs';

export const GH_API = 'https://api.github.com';
export const CONCURRENCY = 6;

let cacheEnabled = true;
const memCache = new Map();

export function setCacheEnabled(enabled) {
  cacheEnabled = Boolean(enabled);
}

export function isCacheEnabled() {
  return cacheEnabled;
}

export function ghHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'chengzi-skills-manager',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function ghFetch(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { headers: ghHeaders() });
    if (response.ok) return response.json();

    const retryable = response.status === 403 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === retries) {
      const hint = response.status === 403 || response.status === 429
        ? ' (set GITHUB_TOKEN for a higher rate limit)'
        : '';
      throw new Error(`GitHub API ${response.status}: ${url}${hint}`);
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    let waitMs = 1000 * 2 ** attempt;
    if (Number.isFinite(retryAfter) && retryAfter > 0) waitMs = retryAfter * 1000;
    else if (Number.isFinite(reset)) waitMs = Math.max(1000, reset * 1000 - Date.now());
    await sleep(Math.min(waitMs, 30_000));
  }
  throw new Error(`GitHub request failed: ${url}`);
}

const cacheKey = (url) => createHash('sha1').update(url).digest('hex');

async function cacheRead(url) {
  if (!(CACHE_TTL_MS > 0)) return undefined;
  try {
    const entry = JSON.parse(await readFile(path.join(CACHE_DIR, `${cacheKey(url)}.json`), 'utf8'));
    if (Number.isFinite(entry?.ts) && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  } catch {
    // Cache misses and malformed entries are harmless.
  }
  return undefined;
}

async function cacheWrite(url, data) {
  if (!(CACHE_TTL_MS > 0)) return;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${cacheKey(url)}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ ts: Date.now(), data }), 'utf8');
    await rename(tmp, file);
  } catch {
    // Disk caching is best effort and must not affect a successful request.
  }
}

/** Memoized fetch: in-process dedup, then TTL'd disk cache, then network. */
export async function cachedCall(url, fn) {
  if (!cacheEnabled) return fn();
  if (memCache.has(url)) return memCache.get(url);
  const pending = (async () => {
    const hit = await cacheRead(url);
    if (hit !== undefined) return hit;
    const data = await fn();
    await cacheWrite(url, data);
    return data;
  })();
  memCache.set(url, pending);
  try {
    return await pending;
  } finally {
    memCache.delete(url);
  }
}

/** Limited-concurrency map used for GitHub requests. */
export async function mapPool(items, limit, fn) {
  const output = new Array(items.length);
  let next = 0;
  const workerCount = Math.min(limit, items.length) || 1;
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      output[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

export async function getDefaultBranch(owner, repo) {
  const url = `${GH_API}/repos/${owner}/${repo}`;
  const data = await cachedCall(url, () => ghFetch(url));
  return data.default_branch;
}

/** Resolve a floating ref (branch/tag/release) to a full commit SHA. */
export async function resolveCommitSha(owner, repo, ref) {
  const url = `${GH_API}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  const data = await cachedCall(url, () => ghFetch(url));
  return data.sha;
}

export async function getTree(owner, repo, ref) {
  const url = `${GH_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const data = await cachedCall(url, () => ghFetch(url));
  if (data.truncated) log.warn('Tree is truncated; some skills may be missing');
  return (data.tree || []).filter((entry) => entry.type === 'blob');
}

export async function fetchRaw(owner, repo, ref, filePath) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${encoded}`;
  return cachedCall(url, async () => {
    const response = await fetch(url, { headers: ghHeaders() });
    if (!response.ok) throw new Error(`Download failed ${response.status}: ${filePath}`);
    return response.text();
  });
}

export function parseRepo(input) {
  if (typeof input !== 'string') return null;
  const match = input.trim().match(/(?:github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  return match ? { owner: match[1], repo: match[2] } : null;
}
