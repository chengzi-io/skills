import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {
  CONCURRENCY,
  fetchRaw as defaultFetchRaw,
  getTree as defaultGetTree,
  mapPool,
} from './github.mjs';
import {
  ROOT,
  destFor,
  exists,
  pluginSkillsDir,
  relPosix,
} from './workspace.mjs';

export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__', '.github', 'docs', 'examples', 'tests',
]);

/** Convert the small glob dialect used by dependencies.json to a RegExp. */
export function globToRegExp(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        // A double-star directory segment may match zero or more segments.
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (character === '*') {
      source += '[^/]*';
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[|\\{}()[\]^$+.-]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

/** Test a skill-root-relative path against ignore patterns. */
export function isIgnoredFile(file, patterns = []) {
  const normalized = String(file).replace(/\\/g, '/').replace(/^\.\//, '');
  return patterns.some((pattern) => {
    const value = String(pattern || '').replace(/^\.\//, '').replace(/\\/g, '/');
    if (!value) return false;
    const candidates = value.startsWith('**/') ? [value, value.slice(3)] : [value];
    return candidates.some((candidate) => globToRegExp(candidate).test(normalized));
  });
}

export function parseFrontmatter(raw) {
  const match = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return YAML.parse(match[1]);
  } catch {
    return null;
  }
}

export function withFrontmatterName(raw, name) {
  const match = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || !/^name\s*:/m.test(match[1])) return raw;
  const newline = match[0].includes('\r\n') ? '\r\n' : '\n';
  const frontmatter = match[1].replace(/^name\s*:.*$/m, `name: ${name}`);
  return `---${newline}${frontmatter}${newline}---${String(raw).slice(match[0].length)}`;
}

export const isSkillFile = (filePath) => filePath.endsWith('/SKILL.md') || filePath === 'SKILL.md';
export const skillRootOf = (filePath) => filePath.slice(0, -'/SKILL.md'.length) || '.';
export const skipped = (filePath) => filePath.split('/').some((segment) => SKIP_DIRS.has(segment));

/** Display group: skills/<category>/<name> -> category; skills/<name> -> skills. */
export function displayGroup(root) {
  if (root === '.') return 'root';
  const segments = root.split('/');
  if (segments[0] === 'skills') return segments.length > 2 ? segments[1] : 'skills';
  return segments[0];
}

/** Find local directories containing SKILL.md, returned relative to root. */
export async function findLocalSkills({
  root = ROOT,
  pluginsRoot = path.join(root, 'plugins'),
  skillsRoot = path.join(root, 'skills'),
} = {}) {
  const output = [];
  const seen = new Set();
  const add = (absolute) => {
    const relative = relPosix(absolute, root);
    if (seen.has(relative)) return;
    seen.add(relative);
    output.push(relative);
  };

  let plugins = [];
  try {
    plugins = await readdir(pluginsRoot, { withFileTypes: true });
  } catch {
    plugins = [];
  }
  for (const plugin of plugins) {
    if (!plugin.isDirectory() || plugin.name.startsWith('.')) continue;
    let entries = [];
    try {
      entries = await readdir(pluginSkillsDir(plugin.name, pluginsRoot), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const full = path.join(pluginSkillsDir(plugin.name, pluginsRoot), entry.name);
      if (await exists(path.join(full, 'SKILL.md'))) add(full);
    }
  }

  const walk = async (directory) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(directory, entry.name);
      if (!entry.isDirectory()) continue;
      if (await exists(path.join(full, 'SKILL.md'))) add(full);
      else await walk(full);
    }
  };
  if (await exists(skillsRoot)) await walk(skillsRoot);
  return output.sort();
}

export async function walkLocal(directory, { includeHidden = false } = {}) {
  const output = [];
  const walk = async (current, base = '') => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if ((!includeHidden && entry.name.startsWith('.')) || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      const relative = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(full, relative);
      else output.push(relative);
    }
  };
  await walk(directory);
  return output;
}

function remoteMethods(remote = {}) {
  remote ||= {};
  const getTree = remote.getTree
    ? (...args) => remote.getTree(...args)
    : defaultGetTree;
  const fetchRaw = remote.fetchRaw
    ? (...args) => remote.fetchRaw(...args)
    : defaultFetchRaw;
  return {
    getTree,
    fetchRaw,
  };
}

function treeBlobs(tree) {
  const entries = Array.isArray(tree) ? tree : tree?.tree || [];
  return entries
    .map((entry) => (typeof entry === 'string' ? { type: 'blob', path: entry } : entry))
    .filter((entry) => entry && typeof entry.path === 'string'
      && (!entry.type || entry.type === 'blob'));
}

/** Find all remote skills in a repository tree. */
export async function discoverSkills(owner, repo, ref, { remote = {} } = {}) {
  const { getTree, fetchRaw } = remoteMethods(remote);
  const blobs = treeBlobs(await getTree(owner, repo, ref)).filter((entry) => !skipped(entry.path));
  const roots = [...new Set(
    blobs.filter((entry) => isSkillFile(entry.path)).map((entry) => skillRootOf(entry.path)),
  )].sort();

  const skills = await mapPool(roots, CONCURRENCY, async (root) => {
    const markdownPath = root === '.' ? 'SKILL.md' : `${root}/SKILL.md`;
    const prefix = root === '.' ? '' : `${root}/`;
    const frontmatter = parseFrontmatter(await fetchRaw(owner, repo, ref, markdownPath));
    if (!frontmatter) return null;
    const files = blobs
      .filter((entry) => entry.path === markdownPath || (prefix && entry.path.startsWith(prefix)))
      .map((entry) => entry.path);
    return {
      root,
      name: frontmatter.name || root.split('/').pop() || 'root',
      description: String(frontmatter.description || '').replace(/\s+/g, ' ').trim(),
      group: displayGroup(root),
      files,
    };
  });
  return skills.filter(Boolean);
}

/**
 * Download a skill into a temporary sibling directory and atomically replace
 * the destination only after every remote file has been fetched.
 */
export async function downloadSkill({ owner, repo, ref, files, root = '.', dest, remote = {} }) {
  const { fetchRaw } = remoteMethods(remote);
  const parent = path.dirname(dest);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, `.tmp-${path.basename(dest)}-${process.pid}-`));
  try {
    for (const file of files) {
      const relative = root === '.' ? file : file.slice(root.length + 1);
      const target = path.join(temporary, ...relative.split('/'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await fetchRaw(owner, repo, ref, file), 'utf8');
    }
    await rm(dest, { recursive: true, force: true });
    await rename(temporary, dest);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

/** Resolve a destination for callers that want the default plugin layout. */
export function defaultSkillDestination(plugin, name) {
  return destFor(plugin, name);
}
