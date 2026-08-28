import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute repository root used by the manager's default adapters. */
export const ROOT = path.resolve(MODULE_DIR, '../..');
export const DEPS_FILE = path.join(ROOT, 'dependencies.json');
export const MKT_FILE = path.join(ROOT, '.claude-plugin', 'marketplace.json');
export const README_FILE = path.join(ROOT, 'README.md');
export const SKILLS_ROOT = path.join(ROOT, 'skills');
export const PLUGINS_ROOT = path.join(ROOT, 'plugins');
export const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'manage');
export const CACHE_TTL_MS = Number(process.env.MANAGE_CACHE_TTL_MS || 10 * 60 * 1000);

export const exists = async (file) => access(file).then(() => true).catch(() => false);

export const safeName = (value) => String(value).replace(/[^a-zA-Z0-9._-]/g, '-') || 'skill';

/** Convert an absolute path to a repository-relative POSIX path. */
export function relPosix(file, base = ROOT) {
  return path.relative(base, file).split(path.sep).join('/');
}

export function pluginSkillsDir(pluginName, pluginsRoot = PLUGINS_ROOT) {
  return path.join(pluginsRoot, pluginName, 'skills');
}

export function destFor(pluginName, skillName, pluginsRoot = PLUGINS_ROOT) {
  return path.join(pluginSkillsDir(pluginName, pluginsRoot), skillName);
}

/** Local skill directory for a flattened dependency. */
export function depLocalDir(dep, {
  root = ROOT,
  skillsRoot = path.join(root, 'skills'),
  pluginsRoot = path.join(root, 'plugins'),
} = {}) {
  const name = localNameOf(dep);
  return dep.target?.plugin
    ? destFor(dep.target.plugin, name, pluginsRoot)
    : path.join(skillsRoot, name);
}

/** Local dir name: target.name, else the final segment of source.path. */
export function localNameOf(dep) {
  return safeName(dep.target?.name || dep.source.path.split('/').pop() || 'skill');
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Atomic JSON write (temporary file followed by rename). */
export async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

export const shortSha = (sha) => (sha && sha.length >= 7 ? sha.slice(0, 7) : sha || '');

export const makeResolved = (sha) => ({
  sha,
  syncedAt: new Date().toISOString(),
});
