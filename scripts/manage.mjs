#!/usr/bin/env node
/**
 * chengzi-skills manager — collect / list / sync / remove / rename skills
 *
 * Usage:
 *   npm run manage                         interactive menu
 *   npm run sync                           CI: sync all third-party skills
 *   npm run sync:check                     CI: fail if any skill is outdated/missing
 *   npm run readme                         regenerate skills table in README.md
 *   npm run readme -- --check              fail if README table is stale
 *   node scripts/manage.mjs --list-repo <owner/repo>
 *   node scripts/manage.mjs sync --no-cache   bypass the GitHub response cache
 *
 * Flow: repo → find SKILL.md → pick → download to skills/<name>/ →
 *       write dependencies.json + marketplace.json
 *
 * GitHub responses (default branch, tree, raw files, commit SHA) are cached
 * under node_modules/.cache/manage for MANAGE_CACHE_TTL_MS (default 10 min);
 * pass --no-cache or set MANAGE_CACHE_TTL_MS=0 to always hit the network.
 */
import {
  select, text, confirm, multiselect, groupMultiselect,
  isCancel, intro, outro, log, spinner,
} from '@clack/prompts';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rm, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPS_FILE = path.join(ROOT, 'dependencies.json');
const MKT_FILE = path.join(ROOT, '.claude-plugin', 'marketplace.json');
const README_FILE = path.join(ROOT, 'README.md');
const SKILLS_ROOT = path.join(ROOT, 'skills');
const GH_API = 'https://api.github.com';
const CONCURRENCY = 6;
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'manage');
const CACHE_TTL_MS = Number(process.env.MANAGE_CACHE_TTL_MS || 10 * 60 * 1000);
let cacheEnabled = true;
const README_START = '<!-- skills:table:start -->';
const README_END = '<!-- skills:table:end -->';
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__', '.github', 'docs', 'examples', 'tests',
]);

/* ---------------- helpers ---------------- */

const exists = async (p) => access(p).then(() => true).catch(() => false);
const safeName = (n) => String(n).replace(/[^a-zA-Z0-9._-]/g, '-') || 'skill';
const truncate = (s, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const oneLine = (s, n = 100) => truncate(String(s || '').replace(/\s+/g, ' ').trim(), n);
const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const shortSha = (sha) => (sha && sha.length >= 7 ? sha.slice(0, 7) : sha || '');
const makeResolved = (sha) => ({
  sha,
  syncedAt: new Date().toISOString(),
});

/** Human-readable source ref, optionally with pinned commit. */
function formatSourceLabel(dep) {
  if (!dep) return 'local';
  const ref = dep.source.branch || dep.source.tag || dep.source.release || '';
  const base = ref ? `${dep.source.repo}@${ref}` : dep.source.repo;
  if (dep.resolved?.sha) return `${base}#${shortSha(dep.resolved.sha)}`;
  return base;
}

/** Section title + lines. Avoid clack note() (CJK breaks the box width). */
function printSection(title, lines) {
  log.step(title);
  log.message(lines.length ? lines.join('\n') : '(none)');
}

/** marketplace skill path -> plugin name (key without leading ./) */
async function skillToPlugin() {
  const mkt = await readJson(MKT_FILE);
  const map = new Map();
  for (const p of mkt.plugins || []) {
    for (const s of p.skills || []) {
      map.set(s.replace(/^\.\//, ''), p.name);
    }
  }
  return map;
}

/** Build readable multi-line list text (groups + air, no dense key=value dump). */
function formatSkillList(rows, { pluginOrder = [] } = {}) {
  const byPlugin = new Map();
  for (const row of rows) {
    const key = row.plugin === '-' ? '(none)' : row.plugin;
    if (!byPlugin.has(key)) byPlugin.set(key, []);
    byPlugin.get(key).push(row);
  }

  const ordered = [];
  for (const name of pluginOrder) {
    if (byPlugin.has(name)) {
      ordered.push([name, byPlugin.get(name)]);
      byPlugin.delete(name);
    }
  }
  if (byPlugin.has('(none)')) {
    ordered.push(['(none)', byPlugin.get('(none)')]);
    byPlugin.delete('(none)');
  }
  for (const entry of byPlugin) ordered.push(entry);

  const third = rows.filter((r) => r.source !== 'local').length;
  const missing = rows.filter((r) => r.local === 'no').length;
  const lines = [
    `total ${rows.length}   third-party ${third}   missing ${missing}`,
    '',
  ];

  for (const [plugin, items] of ordered) {
    items.sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`[${plugin}]  ${items.length}`);
    lines.push('');
    for (const item of items) {
      const mark = item.local === 'no' ? '  ! missing' : '';
      lines.push(`  ${item.name}${mark}`);
      lines.push(`    source  ${item.source}`);
      lines.push(`    path    ${item.path}`);
      lines.push('');
    }
  }

  // trim trailing blank lines
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Local dir name: target.name, else last segment of source.path */
export function localNameOf(dep) {
  return safeName(dep.target?.name || dep.source.path.split('/').pop() || 'skill');
}

export function parseRepo(input) {
  const m = input.trim().match(/(?:github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Atomic JSON write (tmp + rename) */
async function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

/** Limited concurrency map (rate-limit friendly) */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function withSpinner(startMsg, fn, doneMsg) {
  const s = spinner();
  s.start(startMsg);
  try {
    const result = await fn((msg) => s.message(msg));
    const msg = typeof doneMsg === 'function' ? doneMsg(result) : (doneMsg ?? startMsg);
    s.stop(msg);
    return result;
  } catch (e) {
    s.stop(e.message, 1);
    throw e;
  }
}

/* ---------------- GitHub API ---------------- */

function ghHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'chengzi-skills-manager',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function ghFetch(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: ghHeaders() });
    if (res.ok) return res.json();

    const retryable = res.status === 403 || res.status === 429 || res.status >= 500;
    if (!retryable || attempt === retries) {
      const hint = res.status === 403 || res.status === 429
        ? ' (set GITHUB_TOKEN for a higher rate limit)'
        : '';
      throw new Error(`GitHub API ${res.status}: ${url}${hint}`);
    }

    const retryAfter = Number(res.headers.get('retry-after'));
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    let waitMs = 1000 * 2 ** attempt;
    if (Number.isFinite(retryAfter) && retryAfter > 0) waitMs = retryAfter * 1000;
    else if (Number.isFinite(reset)) waitMs = Math.max(1000, reset * 1000 - Date.now());
    waitMs = Math.min(waitMs, 30_000);
    await sleep(waitMs);
  }
}

/* ---------------- GitHub response cache ---------------- */

const memCache = new Map();
const cacheKey = (url) => createHash('sha1').update(url).digest('hex');

async function cacheRead(url) {
  if (!(CACHE_TTL_MS > 0)) return undefined;
  try {
    const entry = JSON.parse(
      await readFile(path.join(CACHE_DIR, `${cacheKey(url)}.json`), 'utf8'),
    );
    if (Number.isFinite(entry?.ts) && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  } catch { /* miss */ }
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
  } catch { /* best-effort */ }
}

/** Memoized fetch: in-process dedup, then TTL'd disk cache, then network. */
async function cachedCall(url, fn) {
  if (!cacheEnabled) return fn();
  if (memCache.has(url)) return memCache.get(url);
  const p = (async () => {
    const hit = await cacheRead(url);
    if (hit !== undefined) return hit;
    const data = await fn();
    await cacheWrite(url, data);
    return data;
  })();
  memCache.set(url, p);
  try { return await p; } finally { memCache.delete(url); }
}

async function getDefaultBranch(owner, repo) {
  const url = `${GH_API}/repos/${owner}/${repo}`;
  const data = await cachedCall(url, () => ghFetch(url));
  return data.default_branch;
}

/** Resolve floating ref (branch/tag/release) to a full commit SHA. */
async function resolveCommitSha(owner, repo, ref) {
  const url = `${GH_API}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  const data = await cachedCall(url, () => ghFetch(url));
  return data.sha;
}

async function getTree(owner, repo, ref) {
  const url = `${GH_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const data = await cachedCall(url, () => ghFetch(url));
  if (data.truncated) log.warn('Tree is truncated; some skills may be missing');
  return (data.tree || []).filter((t) => t.type === 'blob');
}

async function fetchRaw(owner, repo, ref, filePath) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${encoded}`;
  return cachedCall(url, async () => {
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) throw new Error(`Download failed ${res.status}: ${filePath}`);
    return res.text();
  });
}

/* ---------------- local skill scan ---------------- */

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  try { return YAML.parse(m[1]); } catch { return null; }
}

const isSkillFile = (p) => p.endsWith('/SKILL.md') || p === 'SKILL.md';
const skillRootOf = (p) => p.slice(0, -'/SKILL.md'.length) || '.';
const skipped = (p) => p.split('/').some((seg) => SKIP_DIRS.has(seg));

/** Display group: skills/<cat>/<name> -> cat; skills/<name> -> skills */
function displayGroup(root) {
  if (root === '.') return 'root';
  const segs = root.split('/');
  if (segs[0] === 'skills') return segs.length > 2 ? segs[1] : 'skills';
  return segs[0];
}

/** Find local dirs with SKILL.md; paths relative to ROOT */
export async function findLocalSkills(dir = SKILLS_ROOT) {
  const out = [];
  const walk = async (d) => {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(d, entry.name);
      if (!entry.isDirectory()) continue;
      if (await exists(path.join(full, 'SKILL.md'))) out.push(path.relative(ROOT, full));
      else await walk(full);
    }
  };
  if (await exists(dir)) await walk(dir);
  return out.sort();
}

export async function walkLocal(dir) {
  const out = [];
  const walk = async (d, base = '') => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(d, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(full, rel);
      else out.push(rel);
    }
  };
  await walk(dir);
  return out;
}

/* ---------------- discover remote skills ---------------- */

/**
 * Find all skills in a repo.
 * Returns [{ root, name, description, group, files }]
 */
export async function discoverSkills(owner, repo, ref) {
  const blobs = (await getTree(owner, repo, ref)).filter((b) => !skipped(b.path));
  const roots = [...new Set(
    blobs.filter((b) => isSkillFile(b.path)).map((b) => skillRootOf(b.path)),
  )].sort();

  const skills = await mapPool(roots, CONCURRENCY, async (root) => {
    const mdPath = root === '.' ? 'SKILL.md' : `${root}/SKILL.md`;
    const prefix = root === '.' ? '' : `${root}/`;
    const fm = parseFrontmatter(await fetchRaw(owner, repo, ref, mdPath));
    if (!fm) return null;
    const files = blobs
      .filter((b) => b.path === mdPath || (prefix && b.path.startsWith(prefix)))
      .map((b) => b.path);
    return {
      root,
      name: fm.name || root.split('/').pop() || 'root',
      description: (fm.description || '').toString().replace(/\s+/g, ' ').trim(),
      group: displayGroup(root),
      files,
    };
  });
  return skills.filter(Boolean);
}

/* ---------------- registry / groups ---------------- */

async function loadGroups() {
  const mkt = await readJson(MKT_FILE);
  return (mkt.plugins || []).map((p) => p.name);
}

function ensurePlugin(mkt, groupName) {
  let plugin = mkt.plugins.find((p) => p.name === groupName);
  if (!plugin) {
    plugin = { name: groupName, description: `${groupName} skills`, source: './', skills: [] };
    mkt.plugins.push(plugin);
  }
  plugin.skills = plugin.skills || [];
  return plugin;
}

/** Download skill to tmp dir, then replace dest */
async function downloadSkill({ owner, repo, ref, files, root, dest }) {
  const tmp = path.join(SKILLS_ROOT, `.tmp-${path.basename(dest)}-${process.pid}`);
  await rm(tmp, { recursive: true, force: true });
  try {
    await mkdir(tmp, { recursive: true });
    for (const file of files) {
      const rel = root === '.' ? file : file.slice(root.length + 1);
      const target = path.join(tmp, ...rel.split('/'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await fetchRaw(owner, repo, ref, file), 'utf8');
    }
    await rm(dest, { recursive: true, force: true });
    await mkdir(path.dirname(dest), { recursive: true });
    await rename(tmp, dest);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  }
}

function upsertDependency(deps, entry) {
  const i = deps.dependencies.findIndex(
    (d) => d.source?.repo === entry.source.repo && d.source?.path === entry.source.path,
  );
  if (i >= 0) {
    deps.dependencies[i] = entry;
    return false;
  }
  deps.dependencies.push(entry);
  return true;
}

function removeFromMarketplace(mkt, relPath) {
  for (const p of mkt.plugins) {
    if (!p.skills?.includes(relPath)) continue;
    p.skills = p.skills.filter((s) => s !== relPath);
  }
  // Drop empty non-main plugins; keep plugins without skills field
  mkt.plugins = mkt.plugins.filter((p) => {
    if (p.name === 'chengzi-skills') return true;
    if (!Array.isArray(p.skills)) return true;
    return p.skills.length > 0;
  });
}

/* ---------------- rename / group helpers ---------------- */

/** Repos already tracked in dependencies.json → refs used (repo picker). */
async function knownRepos() {
  const deps = await readJson(DEPS_FILE);
  const byRepo = new Map();
  for (const d of deps.dependencies || []) {
    if (!d.source?.repo) continue;
    if (!byRepo.has(d.source.repo)) byRepo.set(d.source.repo, new Set());
    const ref = d.source.branch || d.source.tag || d.source.release;
    if (ref) byRepo.get(d.source.repo).add(ref);
  }
  return byRepo;
}

/** Pick an existing plugin group or create a new one; null on cancel. */
async function selectGroup(message) {
  const existingGroups = await loadGroups();
  const choice = await select({
    message,
    options: [
      ...existingGroups.map((g) => ({ value: g, label: g })),
      { value: '__new__', label: 'New group…' },
    ],
  });
  if (isCancel(choice)) return null;
  if (choice !== '__new__') return choice;
  const name = await text({
    message: 'New group name?',
    placeholder: 'e.g. qa, data, backend',
    validate: (v) => (/^[a-z0-9-]+$/.test(v.trim()) ? undefined : 'Use a-z, 0-9, and - only'),
  });
  if (isCancel(name)) return null;
  return name.trim();
}

/** Rewrite the `name:` line inside SKILL.md frontmatter, keeping the rest intact. */
export function withFrontmatterName(raw, name) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m || !/^name\s*:/m.test(m[1])) return raw;
  const nl = m[0].includes('\r\n') ? '\r\n' : '\n';
  const fm = m[1].replace(/^name\s*:.*$/m, `name: ${name}`);
  return `---${nl}${fm}${nl}---${raw.slice(m[0].length)}`;
}

export function renameInMarketplace(mkt, oldPath, newPath) {
  for (const p of mkt.plugins) {
    if (!Array.isArray(p.skills)) continue;
    p.skills = p.skills.map((s) => (s === oldPath ? newPath : s));
  }
}

export function moveInMarketplace(mkt, relPath, groupName) {
  for (const p of mkt.plugins) {
    if (!Array.isArray(p.skills)) continue;
    p.skills = p.skills.filter((s) => s !== relPath);
  }
  const plugin = ensurePlugin(mkt, groupName);
  if (!plugin.skills.includes(relPath)) plugin.skills.push(relPath);
  // Drop groups left empty by the move (keep main + plugins without a skills list)
  mkt.plugins = mkt.plugins.filter((p) => {
    if (p.name === 'chengzi-skills') return true;
    if (!Array.isArray(p.skills)) return true;
    return p.skills.length > 0;
  });
}

/**
 * Rename a skill end to end: directory, SKILL.md `name`, marketplace path,
 * dependency target.name. Persists marketplace + dependencies.
 */
export async function renameSkillTo(item, newName, deps) {
  const parts = item.dir.split('/');
  parts[parts.length - 1] = newName;
  const newDir = parts.join('/');

  const md = path.join(ROOT, item.dir, 'SKILL.md');
  if (await exists(md)) {
    const raw = await readFile(md, 'utf8');
    const updated = withFrontmatterName(raw, newName);
    if (updated !== raw) await writeFile(md, updated, 'utf8');
  }

  await rename(path.join(ROOT, item.dir), path.join(ROOT, newDir));

  const mkt = await readJson(MKT_FILE);
  renameInMarketplace(mkt, `./${item.dir}`, `./${newDir}`);
  if (item.dep) item.dep.target.name = newName;
  await writeJson(MKT_FILE, mkt);
  await writeJson(DEPS_FILE, deps);
}

/* ---------------- collect ---------------- */

async function collectSkill() {
  log.step('Add skill from GitHub');

  const known = await knownRepos();
  const repoOptions = [...known.keys()].map((repo) => ({
    value: repo,
    label: repo,
    hint: [...known.get(repo)].join(', '),
  }));

  let repoInput = null;
  if (repoOptions.length > 0) {
    const choice = await select({
      message: 'Source repo? (pick one used before, or type a new one)',
      options: [
        ...repoOptions,
        { value: '__new__', label: 'Type a new repo…' },
      ],
    });
    if (isCancel(choice)) return false;
    if (choice !== '__new__') repoInput = choice;
  }

  if (repoInput === null) {
    repoInput = await text({
      message: 'Source repo (owner/repo)?',
      placeholder: 'emilkowalski/skills',
      validate: (v) => (parseRepo(v) ? undefined : 'Use owner/repo, e.g. emilkowalski/skills'),
    });
    if (isCancel(repoInput)) return false;
  }
  const { owner, repo } = parseRepo(repoInput);

  let defaultBranch;
  try {
    defaultBranch = await withSpinner(
      'Connecting to GitHub…',
      () => getDefaultBranch(owner, repo),
      (b) => `${owner}/${repo} @ ${b}`,
    );
  } catch {
    return false;
  }

  const knownRef = [...(known.get(`${owner}/${repo}`) || [])][0] || '';
  const branchInput = await text({
    message: 'Branch or tag?',
    placeholder: knownRef || defaultBranch,
    initialValue: knownRef || defaultBranch,
  });
  if (isCancel(branchInput)) return false;
  const ref = branchInput.trim() || defaultBranch;

  let skills;
  try {
    skills = await withSpinner(
      'Finding skills…',
      () => discoverSkills(owner, repo, ref),
      (list) => `Found ${list.length} skill(s)`,
    );
  } catch {
    return false;
  }
  if (skills.length === 0) {
    log.warn('No SKILL.md found');
    return false;
  }

  const byGroup = {};
  for (const s of skills) {
    (byGroup[s.group] ||= []).push({
      value: s.root,
      label: s.name,
      hint: truncate(s.description),
    });
  }

  const picked = await groupMultiselect({
    message: 'Pick skills (space to toggle, enter to confirm)',
    options: byGroup,
    required: false,
  });
  if (isCancel(picked)) return false;
  const selected = skills.filter((s) => picked.includes(s.root));
  if (selected.length === 0) {
    log.warn('No skill selected');
    return false;
  }

  const groupName = await selectGroup('Which plugin group?');
  if (groupName === null) return false;

  const planned = selected.map((s) => ({ skill: s, name: safeName(s.name) }));
  const conflicts = [];
  for (const p of planned) {
    if (await exists(path.join(SKILLS_ROOT, p.name))) conflicts.push(p.name);
  }
  if (conflicts.length > 0) {
    const overwrite = await confirm({
      message: `Already exists: ${conflicts.join(', ')}. Overwrite?`,
      initialValue: false,
    });
    if (isCancel(overwrite) || !overwrite) {
      log.warn('Cancelled');
      return false;
    }
  }

  let deps;
  let mkt;
  try {
    deps = await readJson(DEPS_FILE);
    mkt = await readJson(MKT_FILE);
  } catch (e) {
    log.error(`Failed to read config: ${e.message}`);
    return false;
  }

  const results = [];
  try {
    await withSpinner('Downloading…', async (msg) => {
      for (const { skill: s, name } of planned) {
        msg(`Download ${name}…`);
        await downloadSkill({
          owner, repo, ref, files: s.files, root: s.root,
          dest: path.join(SKILLS_ROOT, name),
        });

        const relPath = `./skills/${name}`;
        const plugin = ensurePlugin(mkt, groupName);
        if (!plugin.skills.includes(relPath)) plugin.skills.push(relPath);

        const sha = await resolveCommitSha(owner, repo, ref);
        const added = upsertDependency(deps, {
          type: 'skill',
          source: { repo: `${owner}/${repo}`, path: s.root, branch: ref },
          resolved: makeResolved(sha),
          target: { plugin: groupName, name },
        });
        results.push({ name, files: s.files.length, group: groupName, added, sha });
      }
      await writeJson(DEPS_FILE, deps);
      await writeJson(MKT_FILE, mkt);
    }, `Added ${planned.length} skill(s)`);
  } catch (e) {
    log.error(e.message);
    return false;
  }

  printSection(
    'Done',
    formatSkillList(
      results.map((r) => ({
        name: r.name + (r.added ? '' : '  (updated)'),
        plugin: r.group,
        source: 'new',
        local: 'yes',
        path: `skills/${r.name}`,
      })),
      { pluginOrder: [...new Set(results.map((r) => r.group))] },
    ),
  );
  await refreshReadme();
  log.message('Tip: claude plugin validate .claude-plugin/marketplace.json');
  return true;
}

/* ---------------- List / README skills table ---------------- */

/** Collect skill rows from local dirs + dependencies (+ marketplace plugin). */
export async function collectSkillRows() {
  const deps = await readJson(DEPS_FILE);
  const localDirs = await findLocalSkills();
  const localSet = new Set(localDirs);
  const pluginOf = await skillToPlugin();

  const depByPath = new Map();
  for (const d of deps.dependencies || []) {
    depByPath.set(`skills/${localNameOf(d)}`, d);
  }

  // union: every local skill + every registered dep (even if missing on disk)
  const paths = new Set([...localDirs, ...depByPath.keys()]);
  const rows = await Promise.all([...paths].sort().map(async (skillPath) => {
    const name = skillPath.split('/').pop();
    const plugin = pluginOf.get(skillPath) || '-';
    const dep = depByPath.get(skillPath);
    const source = dep ? formatSourceLabel(dep) : 'local';
    const syncedAt = dep?.resolved?.syncedAt || '';

    let description = '';
    if (localSet.has(skillPath)) {
      try {
        const raw = await readFile(path.join(ROOT, skillPath, 'SKILL.md'), 'utf8');
        const fm = parseFrontmatter(raw);
        description = oneLine(fm?.description, 100);
      } catch {
        description = '';
      }
    }

    return {
      name,
      plugin,
      source,
      syncedAt,
      description,
      local: localSet.has(skillPath) ? 'yes' : 'no',
      path: skillPath,
    };
  }));

  // Prefer marketplace plugin order, then name — keeps README table grouped
  const mkt = await readJson(MKT_FILE);
  const pluginRank = new Map((mkt.plugins || []).map((p, i) => [p.name, i]));
  rows.sort((a, b) => {
    const ra = pluginRank.has(a.plugin) ? pluginRank.get(a.plugin) : 999;
    const rb = pluginRank.has(b.plugin) ? pluginRank.get(b.plugin) : 999;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

/** Markdown table for README (Skill / Plugin / Source / Synced / Description). */
export function renderSkillsTable(rows) {
  const header = '| Skill | Plugin | Source | Synced | Description |';
  const sep = '|-------|--------|--------|--------|-------------|';
  if (rows.length === 0) {
    return [header, sep, '| _(none)_ | | | | |'].join('\n');
  }

  const body = rows.map((r) => {
    const skill = r.local === 'no'
      ? `\`${r.name}\` ⚠️ missing`
      : `[\`${r.name}\`](${r.path})`;
    const synced = r.syncedAt
      ? r.syncedAt.slice(0, 10)
      : (r.source === 'local' ? '—' : 'unknown');
    return `| ${mdCell(skill)} | ${mdCell(r.plugin)} | ${mdCell(r.source)} | ${mdCell(synced)} | ${mdCell(r.description)} |`;
  });
  return [header, sep, ...body].join('\n');
}

/**
 * Refresh the auto-generated skills table between markers in README.md.
 * @param {{ checkOnly?: boolean, quiet?: boolean }} [opts]
 * @returns {Promise<{ changed: boolean, count: number, missingMarkers?: boolean }>}
 */
export async function updateReadmeSkillsTable({ checkOnly = false, quiet = false } = {}) {
  const rows = await collectSkillRows();
  const table = renderSkillsTable(rows);
  const block = `${README_START}\n\n${table}\n\n${README_END}`;

  let readme;
  try {
    readme = await readFile(README_FILE, 'utf8');
  } catch (e) {
    throw new Error(`README.md unreadable: ${e.message}`);
  }

  if (!readme.includes(README_START) || !readme.includes(README_END)) {
    return { changed: true, count: rows.length, missingMarkers: true };
  }

  const re = new RegExp(
    `${README_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${README_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  );
  const next = readme.replace(re, () => block);
  const changed = next !== readme;

  if (checkOnly || !changed) {
    return { changed, count: rows.length };
  }

  await writeFile(README_FILE, next, 'utf8');
  if (!quiet) log.success(`README skills table updated (${rows.length} skill(s))`);
  return { changed: true, count: rows.length };
}

/**
 * Refresh README after skill mutations. Throws if markers missing or I/O fails
 * so add/sync/remove cannot "succeed" with a stale table silently.
 *
 * Guaranteed call sites (must stay in sync with this list):
 *   - collectSkill (Add skill)
 *   - manageCollected sync / remove
 *   - syncAll (pnpm sync), after file + pin writes
 * Drift detection (does not write):
 *   - validateAll / `pnpm readme -- --check`
 * Manual: `pnpm readme`
 * NOT covered: hand-editing SKILL.md / marketplace / deps without manager
 */
async function refreshReadme({ quiet = true } = {}) {
  const r = await updateReadmeSkillsTable({ quiet });
  if (r.missingMarkers) {
    throw new Error(
      'README.md missing <!-- skills:table:start --> / <!-- skills:table:end --> markers',
    );
  }
  if (r.changed && quiet) log.success(`README skills table updated (${r.count})`);
  return r;
}

async function listCollected() {
  const mkt = await readJson(MKT_FILE);
  const rows = await collectSkillRows();
  const pluginOrder = (mkt.plugins || []).map((p) => p.name);
  printSection('All skills', formatSkillList(rows, { pluginOrder }));
  return true;
}

/* ---------------- validate ---------------- */

async function validateAll() {
  let errors = 0;
  const err = (msg) => { log.error(msg); errors++; };
  const section = async (label, fn) => {
    const before = errors;
    try { await fn(); }
    catch (e) { err(`${label}: ${e.message}`); }
    if (errors === before) log.success(label);
  };
  const localDirs = await findLocalSkills();

  await section('dependencies.json ok', async () => {
    const deps = await readJson(DEPS_FILE);
    if (deps.version !== 1) err('dependencies.json: version must be 1');
    if (!Array.isArray(deps.dependencies)) err('dependencies.json: dependencies must be an array');
    for (const d of deps.dependencies ?? []) {
      if (!['skill', 'agent'].includes(d.type)) err(`Bad type: ${JSON.stringify(d)}`);
      if (!d.source?.repo || !d.source?.path) err(`Missing source.repo/path: ${JSON.stringify(d)}`);
      if (!d.target?.plugin) err(`Missing target.plugin: ${JSON.stringify(d)}`);
      const refs = ['branch', 'tag', 'release'].filter((k) => d.source?.[k]);
      if (refs.length > 1) err(`${d.source?.repo}: use only one of branch/tag/release`);
      if (!d.resolved?.sha) {
        err(`${localNameOf(d)}: missing resolved.sha (run pnpm sync to pin)`);
      } else if (!/^[0-9a-f]{40}$/.test(d.resolved.sha)) {
        err(`${localNameOf(d)}: resolved.sha must be a 40-char hex commit`);
      }
      if (!d.resolved?.syncedAt) {
        err(`${localNameOf(d)}: missing resolved.syncedAt`);
      } else if (Number.isNaN(Date.parse(d.resolved.syncedAt))) {
        err(`${localNameOf(d)}: resolved.syncedAt is not a valid date`);
      }
    }
  });

  await section('marketplace.json ok', async () => {
    const mkt = await readJson(MKT_FILE);
    const declared = new Set();
    for (const p of mkt.plugins ?? []) {
      for (const s of p.skills ?? []) {
        declared.add(s);
        if (!(await exists(path.join(ROOT, s, 'SKILL.md')))) {
          err(`marketplace.json: ${s} missing or no SKILL.md`);
        }
      }
    }
    for (const dir of localDirs) {
      const key = `./${dir}`;
      if (!declared.has(key)) err(`${key} not in marketplace.json (will show as Other)`);
    }
  });

  await section('SKILL.md frontmatter ok', async () => {
    for (const dir of localDirs) {
      const raw = await readFile(path.join(ROOT, dir, 'SKILL.md'), 'utf8');
      const fm = parseFrontmatter(raw);
      if (!fm) { err(`${dir}/SKILL.md: missing frontmatter`); continue; }
      if (!fm.name) err(`${dir}/SKILL.md: missing name`);
      if (!fm.description) err(`${dir}/SKILL.md: missing description`);
    }
  });

  await section('README skills table ok', async () => {
    const r = await updateReadmeSkillsTable({ checkOnly: true });
    if (r.missingMarkers) {
      err('README.md missing <!-- skills:table:start --> / <!-- skills:table:end --> markers');
    } else if (r.changed) {
      err('README skills table is stale — run: pnpm readme');
    }
  });

  log.message(errors === 0 ? 'All checks passed' : `${errors} problem(s)`);
  return errors === 0;
}

/* ---------------- sync / remove ---------------- */

/** Diff local skill dir vs upstream */
export async function compareWithUpstream(dep) {
  const [owner, repo] = dep.source.repo.split('/');
  const ref = dep.source.branch || dep.source.tag || dep.source.release;
  if (!ref) throw new Error(`${dep.source.repo}: missing branch/tag/release`);

  const name = localNameOf(dep);
  const localDir = path.join(SKILLS_ROOT, name);
  const localFiles = await walkLocal(localDir).catch(() => null);
  if (localFiles === null) return { missing: true, localName: name };

  const blobs = await getTree(owner, repo, ref);
  const prefix = dep.source.path === '.' ? '' : `${dep.source.path}/`;
  const upstreamFiles = blobs
    .filter((b) => b.path.startsWith(prefix) && b.path !== prefix.replace(/\/$/, ''))
    .map((b) => b.path.slice(prefix.length))
    .filter(Boolean);

  const remoteOnly = upstreamFiles.filter((f) => !localFiles.includes(f));
  const localOnly = localFiles.filter((f) => !upstreamFiles.includes(f));

  const common = upstreamFiles.filter((f) => localFiles.includes(f));
  const changedFiles = [];
  await mapPool(common, CONCURRENCY, async (f) => {
    const upstream = await fetchRaw(owner, repo, ref, prefix + f);
    const local = await readFile(path.join(localDir, ...f.split('/')), 'utf8').catch(() => null);
    if (local !== upstream) changedFiles.push(f);
  });

  const sha = await resolveCommitSha(owner, repo, ref);

  return {
    missing: false,
    localName: name,
    ref,
    sha,
    remoteOnly,
    localOnly,
    changed: changedFiles.length,
    changedFiles,
    total: upstreamFiles.length,
  };
}

/** Build checklist vs upstream for each dep */
export async function buildChecklist(entries) {
  return mapPool(entries, Math.min(3, entries.length || 1), async (dep) => {
    try {
      const r = await compareWithUpstream(dep);
      if (r.missing) return { dep, status: 'missing', r: null };
      if (r.changed > 0 || r.remoteOnly.length > 0) return { dep, status: 'outdated', r };
      return { dep, status: 'fresh', r };
    } catch (e) {
      return { dep, status: 'error', r: null, error: e.message };
    }
  });
}

async function syncToLocal(r, dep, { quiet = false } = {}) {
  const [owner, repo] = dep.source.repo.split('/');
  const ref = dep.source.branch || dep.source.tag || dep.source.release;
  const prefix = dep.source.path === '.' ? '' : `${dep.source.path}/`;
  const localDir = path.join(SKILLS_ROOT, r.localName);
  const files = [...r.remoteOnly, ...r.changedFiles];
  for (const f of files) {
    const content = await fetchRaw(owner, repo, ref, prefix + f);
    const target = path.join(localDir, ...f.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  dep.resolved = makeResolved(r.sha);
  const msg = `${r.localName}: synced ${files.length} file(s) (@ ${shortSha(r.sha)})`;
  if (quiet) console.log(`  ok  ${msg}`);
  else log.success(msg);
  if (r.localOnly.length > 0) {
    const warn = `${r.localName}: kept local-only files: ${r.localOnly.join(', ')}`;
    if (quiet) console.warn(`  warn  ${warn}`);
    else log.warn(warn);
  }
}

/** Full reinstall when local dir is missing */
async function reinstallFromDep(dep, { quiet = false } = {}) {
  const [owner, repo] = dep.source.repo.split('/');
  const ref = dep.source.branch || dep.source.tag || dep.source.release;
  if (!ref) throw new Error(`${dep.source.repo}: missing branch/tag/release`);
  const name = localNameOf(dep);
  const root = dep.source.path;
  const blobs = await getTree(owner, repo, ref);
  const files = root === '.'
    ? blobs.filter((b) => b.path === 'SKILL.md').map((b) => b.path)
    : blobs.filter((b) => b.path.startsWith(`${root}/`)).map((b) => b.path);
  if (files.length === 0) throw new Error(`${name}: no files under ${root} in ${owner}/${repo}@${ref}`);

  const sha = await resolveCommitSha(owner, repo, ref);
  await downloadSkill({
    owner,
    repo,
    ref,
    files,
    root,
    dest: path.join(SKILLS_ROOT, name),
  });
  dep.resolved = makeResolved(sha);
  const msg = `${name}: reinstalled ${files.length} file(s) from ${owner}/${repo}@${ref}#${shortSha(sha)}`;
  if (quiet) console.log(`  ok  ${msg}`);
  else log.success(msg);
  return { localName: name, sha };
}

/**
 * Non-interactive sync for CI / scripts.
 * @param {{ checkOnly?: boolean }} opts
 *   checkOnly: report drift only, do not write files (exit non-zero if drift)
 * @returns {{ ok: boolean, fresh: number, synced: number, missing: number, errors: number, details: object[] }}
 */
export async function syncAll({ checkOnly = false } = {}) {
  const deps = await readJson(DEPS_FILE);
  const entries = deps.dependencies || [];
  if (entries.length === 0) {
    console.log('No third-party skills in dependencies.json');
    return { ok: true, fresh: 0, synced: 0, missing: 0, errors: 0, details: [] };
  }

  console.log(`Checking ${entries.length} skill(s) against upstream…`);
  const items = await buildChecklist(entries);
  const details = items.map((i) => ({
    name: localNameOf(i.dep),
    status: i.status,
    error: i.error,
    changed: i.r?.changed,
    remoteOnly: i.r?.remoteOnly?.length,
    sha: i.r?.sha?.slice(0, 8),
  }));

  const fresh = items.filter((i) => i.status === 'fresh');
  const outdated = items.filter((i) => i.status === 'outdated');
  const missing = items.filter((i) => i.status === 'missing');
  const errors = items.filter((i) => i.status === 'error');

  for (const i of fresh) {
    const pin = i.dep.resolved?.sha ? shortSha(i.dep.resolved.sha) : 'unpinned';
    const tip = i.r?.sha ? shortSha(i.r.sha) : '?';
    console.log(`  =  ${localNameOf(i.dep)}  up to date  pin ${pin}  tip ${tip}`);
  }
  for (const i of outdated) {
    const pin = i.dep.resolved?.sha ? shortSha(i.dep.resolved.sha) : 'unpinned';
    console.log(
      `  ^  ${i.r.localName}  +${i.r.remoteOnly.length} new / ${i.r.changed} changed  pin ${pin} → tip ${shortSha(i.r.sha)}`,
    );
  }
  for (const i of missing) console.log(`  x  ${localNameOf(i.dep)}  missing on disk`);
  for (const i of errors) console.error(`  !  ${localNameOf(i.dep)}  ${i.error}`);

  if (checkOnly) {
    const unpinned = entries.filter((d) => !d.resolved?.sha).length;
    const ok = outdated.length === 0 && missing.length === 0 && errors.length === 0 && unpinned === 0;
    console.log(
      ok
        ? `Check ok: ${fresh.length} up to date`
        : `Check failed: ${outdated.length} outdated, ${missing.length} missing, ${unpinned} unpinned, ${errors.length} error(s)`,
    );
    return {
      ok,
      fresh: fresh.length,
      synced: 0,
      missing: missing.length,
      errors: errors.length,
      details,
    };
  }

  let synced = 0;
  let fail = errors.length;
  let pinned = 0;
  const toFix = [...outdated, ...missing];

  // Backfill pin for content that already matches tip
  for (const i of fresh) {
    if (i.r?.sha && (!i.dep.resolved?.sha || !i.dep.resolved?.syncedAt)) {
      i.dep.resolved = makeResolved(i.r.sha);
      pinned++;
    }
  }

  if (toFix.length > 0) {
    console.log(`Syncing ${toFix.length} skill(s)…`);
    for (const item of toFix) {
      try {
        if (item.status === 'missing') await reinstallFromDep(item.dep, { quiet: true });
        else await syncToLocal(item.r, item.dep, { quiet: true });
        synced++;
      } catch (e) {
        fail++;
        console.error(`  !  ${localNameOf(item.dep)}: ${e.message}`);
      }
    }
  }

  if (synced > 0 || pinned > 0) {
    await writeJson(DEPS_FILE, deps);
    if (pinned > 0) console.log(`  ok  pinned ${pinned} resolved commit(s) in dependencies.json`);
  }

  const ok = fail === 0;
  if (toFix.length === 0 && fail === 0) {
    console.log(`Sync ok: ${fresh.length} already up to date${pinned ? `, pinned ${pinned}` : ''}`);
  } else {
    console.log(
      ok
        ? `Sync ok: ${synced} updated, ${fresh.length} unchanged`
        : `Sync finished with errors: ${synced} updated, ${fail} failed, ${fresh.length} unchanged`,
    );
  }

  // Always refresh README after sync (content, pins, or both may have changed)
  try {
    const r = await updateReadmeSkillsTable({ quiet: true });
    if (r.missingMarkers) {
      console.error('  !  README.md missing skills:table markers');
      return {
        ok: false,
        fresh: fresh.length,
        synced,
        missing: missing.length,
        errors: fail + 1,
        details,
      };
    }
    if (r.changed) console.log(`  ok  README skills table updated (${r.count})`);
  } catch (e) {
    console.error(`  !  README table refresh failed: ${e.message}`);
    return {
      ok: false,
      fresh: fresh.length,
      synced,
      missing: missing.length,
      errors: fail + 1,
      details,
    };
  }

  return {
    ok,
    fresh: fresh.length,
    synced,
    missing: missing.length,
    errors: fail,
    details,
  };
}

async function manageCollected() {
  const deps = await readJson(DEPS_FILE);
  const entries = deps.dependencies || [];
  const localDirs = await findLocalSkills();

  // Union of registered deps (even when missing on disk) + local-only skills
  const depByDir = new Map();
  for (const d of entries) depByDir.set(`skills/${localNameOf(d)}`, d);
  const dirs = [...new Set([...localDirs, ...depByDir.keys()])].sort();
  if (dirs.length === 0) {
    log.info('No skills yet. Use "Add skill" first.');
    return false;
  }

  const byDir = new Map(dirs.map((dir) => [
    dir,
    {
      name: dir.split('/').pop(),
      dir,
      dep: depByDir.get(dir) || null,
      status: depByDir.has(dir) ? 'unknown' : 'local',
      r: null,
      error: null,
    },
  ]));

  // Ask before hitting upstream; default NO
  let checked = false;
  if (entries.length > 0) {
    const doCheck = await confirm({
      message: 'Check upstream for updates?',
      initialValue: false,
    });
    if (isCancel(doCheck)) return false;
    checked = doCheck;
  }

  if (checked) {
    try {
      const items = await withSpinner(
        `Checking ${entries.length} skill(s)…`,
        () => buildChecklist(entries),
        (list) => {
          const n = list.filter((i) => i.status === 'outdated').length;
          return n > 0 ? `Done: ${n} update(s)` : 'Done: all up to date';
        },
      );
      for (const { dep, status, r, error } of items) {
        const item = byDir.get(`skills/${localNameOf(dep)}`);
        if (!item) continue;
        item.status = status;
        item.r = r;
        item.error = error || null;
      }
    } catch (e) {
      log.error(e.message);
      return false;
    }
  }

  const all = [...byDir.values()];
  const outdated = all.filter((i) => i.status === 'outdated');
  const fresh = all.filter((i) => i.status === 'fresh');
  const missing = all.filter((i) => i.status === 'missing');
  const errors = all.filter((i) => i.status === 'error');

  for (const i of errors) log.error(`${i.name}: check failed (${i.error})`);
  if (outdated.length > 0) {
    log.warn(
      `^ ${outdated.length} update(s): ${outdated
        .map((i) => `${i.name}(+${i.r.remoteOnly.length}/~${i.r.changed})`)
        .join(', ')}`,
    );
  }
  if (missing.length > 0) {
    log.warn(`x ${missing.length} missing: ${missing.map((i) => i.name).join(', ')}`);
  }
  if (fresh.length > 0) log.success(`${fresh.length} up to date`);

  const options = all.map((item) => {
    const prefix = item.status === 'outdated' ? '^ ' : item.status === 'missing' ? 'x ' : item.status === 'error' ? '? ' : '  ';
    let hint = item.status === 'local' ? 'local skill' : formatSourceLabel(item.dep);
    if (item.status === 'outdated') hint = `+${item.r.remoteOnly.length} new / ${item.r.changed} changed @ ${item.r.sha.slice(0, 8)}`;
    else if (item.status === 'fresh') hint = `${item.r.total} file(s), latest @ ${item.r.sha.slice(0, 8)}`;
    else if (item.status === 'missing') hint = 'missing on disk';
    else if (item.status === 'error') hint = 'check failed';
    return { value: item.name, label: `${prefix}${item.name}`, hint };
  });

  const byName = new Map(all.map((i) => [i.name, i]));
  const picked = await multiselect({
    message: checked
      ? 'Pick skills (^ = update available, pre-selected)'
      : 'Pick skills (space to toggle, enter to confirm)',
    options,
    initialValues: outdated.map((i) => i.name),
    required: false,
  });
  if (isCancel(picked)) return false;
  if (picked.length === 0) {
    log.warn('No skill selected');
    return false;
  }

  const action = await select({
    message: `Action for ${picked.length} skill(s)?`,
    options: [
      { value: 'sync', label: 'Sync from upstream', hint: 'overwrite local (keep local-only files)' },
      { value: 'rename', label: 'Rename', hint: 'dir + SKILL.md + registry' },
      { value: 'group', label: 'Change group', hint: 'move to another plugin group' },
      { value: 'remove', label: 'Remove', hint: 'delete local + registry (cannot undo)' },
      { value: 'cancel', label: 'Cancel' },
    ],
  });
  if (isCancel(action) || action === 'cancel') {
    log.warn('Cancelled');
    return false;
  }

  if (action === 'sync') {
    const toSync = picked.map((n) => byName.get(n)).filter((i) => i?.status === 'outdated');
    const skipped = picked.length - toSync.length;
    if (toSync.length === 0) {
      log.info('All selected skills are already up to date');
      return true;
    }
    if (skipped > 0) log.message(`Skip ${skipped} skill(s) without updates`);

    const ok = await confirm({
      message: `Sync ${toSync.length} skill(s) (overwrite local files)?`,
      initialValue: true,
    });
    if (isCancel(ok) || !ok) {
      log.warn('Cancelled');
      return true;
    }

    try {
      await withSpinner('Syncing…', async (msg) => {
        for (const i of toSync) {
          msg(`Sync ${i.name}…`);
          await syncToLocal(i.r, i.dep);
        }
        // Persist resolved.sha / syncedAt written onto dep objects
        await writeJson(DEPS_FILE, deps);
      }, `Synced ${toSync.length} skill(s)`);
    } catch (e) {
      log.error(e.message);
      return false;
    }
    await refreshReadme();
    return true;
  }

  if (action === 'rename') {
    if (picked.length !== 1) {
      log.warn('Rename works on one skill at a time');
      return true;
    }
    const item = byName.get(picked[0]);
    if (!(await exists(path.join(ROOT, item.dir)))) {
      log.error(`${item.name} is missing on disk — sync first`);
      return true;
    }
    const newName = await text({
      message: `New name for ${item.name}?`,
      placeholder: 'e.g. my-skill',
      validate: (v) => {
        const n = v.trim();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n)) {
          return 'Use lowercase letters, numbers, and single hyphens only';
        }
        if (n === item.name) return 'Name unchanged';
        return undefined;
      },
    });
    if (isCancel(newName)) return false;

    const n = newName.trim();
    const newDir = `${item.dir.slice(0, item.dir.lastIndexOf('/'))}/${n}`;
    if (await exists(path.join(ROOT, newDir))) {
      log.error(`Already exists: ${newDir}`);
      return true;
    }

    const ok = await confirm({
      message: `Rename ${item.name} → ${n}? (dir + SKILL.md + registry)`,
      initialValue: true,
    });
    if (isCancel(ok) || !ok) {
      log.warn('Cancelled');
      return true;
    }

    try {
      await withSpinner('Renaming…', async () => {
        await renameSkillTo(item, n, deps);
      }, `Renamed ${item.name} → ${n}`);
    } catch (e) {
      log.error(e.message);
      return false;
    }
    await refreshReadme();
    return true;
  }

  if (action === 'group') {
    const groupName = await selectGroup('Which plugin group?');
    if (groupName === null) return false;

    try {
      await withSpinner('Moving…', async () => {
        const mkt = await readJson(MKT_FILE);
        for (const name of picked) {
          const item = byName.get(name);
          moveInMarketplace(mkt, `./${item.dir}`, groupName);
          if (item.dep) item.dep.target.plugin = groupName;
        }
        await writeJson(MKT_FILE, mkt);
        await writeJson(DEPS_FILE, deps);
      }, `Moved ${picked.length} skill(s) to ${groupName}`);
    } catch (e) {
      log.error(e.message);
      return false;
    }
    await refreshReadme();
    return true;
  }

  const ok = await confirm({
    message: `Delete ${picked.length} skill(s) (${picked.join(', ')})? Cannot undo`,
    initialValue: false,
  });
  if (isCancel(ok) || !ok) {
    log.warn('Cancelled');
    return false;
  }

  try {
    await withSpinner('Removing…', async (msg) => {
      const mkt = await readJson(MKT_FILE);
      const pickedDirs = new Set(picked.map((n) => byName.get(n).dir));
      for (const name of picked) {
        const item = byName.get(name);
        msg(`Remove ${name}…`);
        await rm(path.join(ROOT, item.dir), { recursive: true, force: true });
        removeFromMarketplace(mkt, `./${item.dir}`);
      }
      deps.dependencies = deps.dependencies.filter((x) => !pickedDirs.has(`skills/${localNameOf(x)}`));
      await writeJson(DEPS_FILE, deps);
      await writeJson(MKT_FILE, mkt);
    }, `Removed ${picked.length} skill(s)`);
  } catch (e) {
    log.error(e.message);
    return false;
  }
  await refreshReadme();
  return true;
}

/* ---------------- main ---------------- */

async function main() {
  intro('chengzi-skills');
  const actions = {
    collect: collectSkill,
    manage: manageCollected,
    list: listCollected,
    validate: validateAll,
  };

  while (true) {
    const action = await select({
      message: 'What do you want to do?',
      options: [
        { value: 'collect', label: 'Add skill', hint: 'from GitHub' },
        { value: 'manage', label: 'Manage skills', hint: 'sync or remove' },
        { value: 'list', label: 'List skills', hint: 'all local + deps' },
        { value: 'validate', label: 'Check config', hint: 'deps / marketplace / frontmatter' },
        { value: 'exit', label: 'Exit' },
      ],
    });

    if (isCancel(action) || action === 'exit') {
      outro('Bye');
      break;
    }

    try {
      await actions[action]();
    } catch (e) {
      log.error(`Unexpected error: ${e.message}`);
    }
  }
}

/* ---------------- CLI ---------------- */

async function runCli(argv) {
  if (argv.includes('--no-cache')) cacheEnabled = false;
  const [cmd, ...rest] = argv;

  // Debug: node scripts/manage.mjs --list-repo <owner/repo>
  if (cmd === '--list-repo' && rest[0]) {
    const parsed = parseRepo(rest[0]);
    if (!parsed) {
      console.error('Use owner/repo');
      process.exit(1);
    }
    const { owner, repo } = parsed;
    const branch = await getDefaultBranch(owner, repo);
    const skills = await discoverSkills(owner, repo, branch);
    console.log(JSON.stringify({ repo: `${owner}/${repo}`, branch, skills }, null, 2));
    return;
  }

  // CI / non-interactive: sync all third-party skills from upstream
  //   node scripts/manage.mjs sync
  //   node scripts/manage.mjs sync --check
  if (cmd === 'sync') {
    const checkOnly = rest.includes('--check');
    const result = await syncAll({ checkOnly });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  // Non-interactive validate (also useful in CI)
  if (cmd === 'validate') {
    const ok = await validateAll();
    process.exitCode = ok ? 0 : 1;
    return;
  }

  // Regenerate README skills table from local skills + dependencies
  //   node scripts/manage.mjs readme
  //   node scripts/manage.mjs readme --check
  if (cmd === 'readme') {
    const checkOnly = rest.includes('--check');
    try {
      const r = await updateReadmeSkillsTable({ checkOnly, quiet: checkOnly });
      if (r.missingMarkers) {
        console.error('README.md missing <!-- skills:table:start --> / <!-- skills:table:end --> markers');
        process.exitCode = 1;
        return;
      }
      if (checkOnly) {
        if (r.changed) {
          console.error(`README skills table is stale (${r.count} skill(s)) — run: pnpm readme`);
          process.exitCode = 1;
        } else {
          console.log(`README skills table ok (${r.count} skill(s))`);
        }
        return;
      }
      console.log(
        r.changed
          ? `README skills table updated (${r.count} skill(s))`
          : `README skills table already up to date (${r.count} skill(s))`,
      );
    } catch (e) {
      console.error(e.message);
      process.exitCode = 1;
    }
    return;
  }

  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(`chengzi-skills manager

Usage:
  npm run manage                 Interactive menu
  npm run sync                   Sync all third-party skills from upstream
  npm run sync:check             Check only (exit 1 if outdated/missing)
  npm run readme                 Regenerate skills table in README.md
  npm run readme -- --check      Fail if README table is stale
  node scripts/manage.mjs validate
  node scripts/manage.mjs --list-repo <owner/repo>
  node scripts/manage.mjs sync --no-cache   bypass GitHub response cache

Env:
  GITHUB_TOKEN        Optional; higher GitHub API rate limit
  MANAGE_CACHE_TTL_MS GitHub response cache TTL in ms (default 600000)
`);
    return;
  }

  if (cmd) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Run with --help for usage');
    process.exitCode = 1;
    return;
  }

  await main();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  runCli(process.argv.slice(2)).catch((e) => {
    console.error(`Unexpected error: ${e.message}`);
    process.exit(1);
  });
}
