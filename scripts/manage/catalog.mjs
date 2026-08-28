import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MKT_FILE, DEPS_FILE, ROOT, depLocalDir, destFor, exists, localNameOf, pluginSkillsDir, readJson, relPosix, safeName, writeJson } from './workspace.mjs';
import { findLocalSkills, withFrontmatterName } from './skills.mjs';

export { depLocalDir, destFor, localNameOf, pluginSkillsDir, relPosix, safeName };

/** Source-block identity: repo plus one ref (v2 groups by repo@ref). */
export const sourceSig = (source) => JSON.stringify([
  source.repo,
  source.branch ?? null,
  source.tag ?? null,
  source.release ?? null,
]);

/**
 * Flatten v2 sources[] into internal dependency entries. The resolved, target,
 * and ignore properties delegate to their source/item so writes persist.
 */
export function flattenDeps(deps) {
  const output = [];
  for (const sourceBlock of deps?.sources ?? []) {
    for (const item of sourceBlock.items ?? []) {
      const source = { repo: sourceBlock.repo, path: item.path };
      for (const key of ['branch', 'tag', 'release']) {
        if (sourceBlock[key]) source[key] = sourceBlock[key];
      }
      const dep = { type: item.type, source };
      Object.defineProperty(dep, 'resolved', {
        enumerable: true,
        get: () => sourceBlock.resolved,
        set: (value) => { sourceBlock.resolved = value; },
      });
      Object.defineProperty(dep, 'target', {
        enumerable: true,
        get: () => item.target,
        set: (value) => { item.target = value; },
      });
      Object.defineProperty(dep, 'ignore', {
        enumerable: true,
        get: () => item.ignore || [],
        set: (value) => { item.ignore = value; },
      });
      output.push(dep);
    }
  }
  return output;
}

/** Add or update a dependency item while retaining the v2 grouping shape. */
export function upsertDependency(deps, entry) {
  deps.sources ??= [];
  let sourceBlock = deps.sources.find((candidate) => sourceSig(candidate) === sourceSig(entry.source));
  if (!sourceBlock) {
    sourceBlock = { repo: entry.source.repo };
    for (const key of ['branch', 'tag', 'release']) {
      if (entry.source[key]) sourceBlock[key] = entry.source[key];
    }
    sourceBlock.items = [];
    deps.sources.push(sourceBlock);
  }
  if (entry.resolved) sourceBlock.resolved = entry.resolved;
  const index = sourceBlock.items.findIndex((item) => item.path === entry.source.path);
  if (index >= 0) {
    const ignore = entry.ignore ?? sourceBlock.items[index].ignore;
    sourceBlock.items[index] = {
      type: entry.type,
      path: entry.source.path,
      target: entry.target,
      ...(ignore?.length ? { ignore } : {}),
    };
    return false;
  }
  sourceBlock.items.push({
    type: entry.type,
    path: entry.source.path,
    target: entry.target,
    ...(entry.ignore?.length ? { ignore: entry.ignore } : {}),
  });
  return true;
}

/** Remove dependency items whose local directories are in pickedDirs. */
export function removeDependencyDirs(deps, pickedDirs, options = {}) {
  let removed = false;
  for (const sourceBlock of deps?.sources ?? []) {
    sourceBlock.items = (sourceBlock.items ?? []).filter((item) => {
      const dep = { type: item.type, source: { path: item.path }, target: item.target };
      if (!pickedDirs.has(relPosix(depLocalDir(dep, options), options.root))) return true;
      removed = true;
      return false;
    });
  }
  deps.sources = (deps.sources ?? []).filter((sourceBlock) => (sourceBlock.items ?? []).length > 0);
  return removed;
}

/** Ensure a marketplace plugin object exists. */
export function ensurePlugin(marketplace, pluginName) {
  marketplace.plugins ??= [];
  let plugin = marketplace.plugins.find((candidate) => candidate.name === pluginName);
  if (!plugin) {
    plugin = {
      name: pluginName,
      description: `${pluginName} skills`,
      source: `./plugins/${pluginName}`,
    };
    marketplace.plugins.push(plugin);
  }
  return plugin;
}

export function removeFromMarketplace(marketplace, relativePath) {
  marketplace.plugins ??= [];
  for (const plugin of marketplace.plugins) {
    if (!plugin.skills?.includes(relativePath)) continue;
    plugin.skills = plugin.skills.filter((skill) => skill !== relativePath);
  }
  marketplace.plugins = marketplace.plugins.filter((plugin) => {
    if (plugin.name === 'chengzi-skills') return true;
    if (!Array.isArray(plugin.skills)) return true;
    return plugin.skills.length > 0;
  });
}

export function renameInMarketplace(marketplace, oldPath, newPath) {
  for (const plugin of marketplace.plugins ?? []) {
    if (!Array.isArray(plugin.skills)) continue;
    plugin.skills = plugin.skills.map((skill) => (skill === oldPath ? newPath : skill));
  }
}

export function moveInMarketplace(marketplace, relativePath, pluginName) {
  marketplace.plugins ??= [];
  for (const plugin of marketplace.plugins) {
    if (!Array.isArray(plugin.skills)) continue;
    plugin.skills = plugin.skills.filter((skill) => skill !== relativePath);
  }
  const plugin = ensurePlugin(marketplace, pluginName);
  if (Array.isArray(plugin.skills)) {
    const skillName = relativePath.split('/').pop();
    const pluginRelative = `./skills/${skillName}`;
    if (!plugin.skills.includes(pluginRelative)) plugin.skills.push(pluginRelative);
  }
  marketplace.plugins = marketplace.plugins.filter((candidate) => {
    if (candidate.name === 'chengzi-skills') return true;
    if (!Array.isArray(candidate.skills)) return true;
    return candidate.skills.length > 0;
  });
}

export async function loadGroups({ mktFile = MKT_FILE } = {}) {
  const marketplace = await readJson(mktFile);
  return (marketplace.plugins || []).map((plugin) => plugin.name);
}

/** Repos already tracked in dependencies.json -> refs used by the picker. */
export async function knownRepos({ depsFile = DEPS_FILE } = {}) {
  const deps = await readJson(depsFile);
  const byRepo = new Map();
  for (const sourceBlock of deps.sources || []) {
    if (!sourceBlock.repo) continue;
    if (!byRepo.has(sourceBlock.repo)) byRepo.set(sourceBlock.repo, new Set());
    const ref = sourceBlock.branch || sourceBlock.tag || sourceBlock.release;
    if (ref) byRepo.get(sourceBlock.repo).add(ref);
  }
  return byRepo;
}

/** Canonical skill path -> marketplace plugin name. */
export async function skillToPlugin({
  mktFile = MKT_FILE,
  root = ROOT,
  findSkills = findLocalSkills,
} = {}) {
  const map = new Map();
  const localSkills = findSkills === findLocalSkills
    ? await findLocalSkills({ root })
    : await findSkills();
  for (const directory of localSkills) {
    const plugin = pluginOfRelPath(directory);
    if (plugin) map.set(directory, plugin);
  }
  const marketplace = await readJson(mktFile);
  for (const plugin of marketplace.plugins || []) {
    const source = typeof plugin.source === 'string' ? plugin.source : plugin.source?.path;
    for (const skill of plugin.skills || []) {
      const key = skill.replace(/^\.\//, '');
      if (map.has(key)) continue;
      if (source) {
        const underPlugin = relPosix(path.join(root, source, key), root);
        if (map.has(underPlugin)) continue;
        map.set(underPlugin, plugin.name);
      }
      map.set(key, plugin.name);
    }
  }
  return map;
}

export function pluginOfRelPath(relativePath) {
  const match = String(relativePath).match(/^plugins\/([^/]+)\/skills\//);
  return match ? match[1] : null;
}

/** Rewrite directory, frontmatter, marketplace and dependency target together. */
export async function renameSkillTo(item, newName, deps, {
  root = ROOT,
  mktFile = MKT_FILE,
  depsFile = DEPS_FILE,
} = {}) {
  const parts = item.dir.split('/');
  parts[parts.length - 1] = newName;
  const newDirectory = parts.join('/');
  const oldAbsolute = path.join(root, item.dir);
  const newAbsolute = path.join(root, newDirectory);
  const markdown = path.join(oldAbsolute, 'SKILL.md');
  if (await exists(markdown)) {
    const raw = await readFile(markdown, 'utf8');
    const updated = withFrontmatterName(raw, newName);
    if (updated !== raw) await writeFile(markdown, updated, 'utf8');
  }
  await mkdir(path.dirname(newAbsolute), { recursive: true });
  await rename(oldAbsolute, newAbsolute);

  const marketplace = await readJson(mktFile);
  renameInMarketplace(marketplace, `./${item.dir}`, `./${newDirectory}`);
  if (item.dep) {
    item.dep.target ??= {};
    item.dep.target.name = newName;
  }
  await writeJson(mktFile, marketplace);
  await writeJson(depsFile, deps);
}

export function formatSourceLabel(dep) {
  if (!dep) return 'local';
  const ref = dep.source.branch || dep.source.tag || dep.source.release || '';
  const base = ref ? `${dep.source.repo}@${ref}` : dep.source.repo;
  if (dep.resolved?.sha) return `${base}#${dep.resolved.sha.length >= 7 ? dep.resolved.sha.slice(0, 7) : dep.resolved.sha}`;
  return base;
}
