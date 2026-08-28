import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { log } from '@clack/prompts';
import {
  DEPS_FILE,
  MKT_FILE,
  README_FILE,
  ROOT,
  depLocalDir,
  readJson,
  relPosix,
} from './workspace.mjs';
import {
  findLocalSkills,
  parseFrontmatter,
} from './skills.mjs';
import {
  flattenDeps,
  formatSourceLabel,
  pluginOfRelPath,
  skillToPlugin,
} from './catalog.mjs';

export const README_START = '<!-- skills:table:start -->';
export const README_END = '<!-- skills:table:end -->';
export const PLUGIN_START = '<!-- plugins:table:start -->';
export const PLUGIN_END = '<!-- plugins:table:end -->';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replace a README marker pair. Does not write. */
export function replaceMarkedBlock(source, start, end, inner) {
  const block = `${start}\n\n${inner}\n\n${end}`;
  if (!source.includes(start) || !source.includes(end)) {
    return { next: source, missing: true, changed: false };
  }
  const expression = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  const next = source.replace(expression, () => block);
  return { next, missing: false, changed: next !== source };
}

export const truncate = (value, length = 60) => {
  const string = String(value);
  return string.length > length ? `${string.slice(0, length)}…` : string;
};

export const oneLine = (value, length = 100) => truncate(
  String(value || '').replace(/\s+/g, ' ').trim(),
  length,
);

export const mdCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** owner/repo from a GitHub URL or already-canonical repo slug. */
export function githubOwnerRepo(urlOrRepo) {
  const value = String(urlOrRepo || '').trim();
  if (!value) return '';
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) return value.replace(/\.git$/, '');
  const match = value.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  return match ? match[1] : '';
}

export function sourceRepoLink(repo) {
  if (!repo) return '-';
  return `[${repo}](https://github.com/${repo})`;
}

export function printSection(title, lines, logger = log) {
  logger.step(title);
  logger.message(lines.length ? lines.join('\n') : '(none)');
}

export function formatSkillList(rows, { pluginOrder = [] } = {}) {
  const byPlugin = new Map();
  for (const row of rows) {
    const key = row.plugin === '-' ? '(none)' : row.plugin;
    if (!byPlugin.has(key)) byPlugin.set(key, []);
    byPlugin.get(key).push(row);
  }

  const ordered = [];
  for (const name of pluginOrder) {
    if (!byPlugin.has(name)) continue;
    ordered.push([name, byPlugin.get(name)]);
    byPlugin.delete(name);
  }
  if (byPlugin.has('(none)')) {
    ordered.push(['(none)', byPlugin.get('(none)')]);
    byPlugin.delete('(none)');
  }
  for (const entry of byPlugin) ordered.push(entry);

  const thirdParty = rows.filter((row) => row.source !== 'local').length;
  const missing = rows.filter((row) => row.local === 'no').length;
  const lines = [`total ${rows.length}   third-party ${thirdParty}   missing ${missing}`, ''];
  for (const [plugin, items] of ordered) {
    items.sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`[${plugin}]  ${items.length}`, '');
    for (const item of items) {
      const mark = item.local === 'no' ? '  ! missing' : '';
      lines.push(`  ${item.name}${mark}`, `    source  ${item.source}`, `    path    ${item.path}`, '');
    }
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Collect local and registered dependency rows for list/README views. */
export async function collectSkillRows({
  root = ROOT,
  depsFile = DEPS_FILE,
  mktFile = MKT_FILE,
  skillsRoot = path.join(root, 'skills'),
  pluginsRoot = path.join(root, 'plugins'),
} = {}) {
  const [deps, marketplace] = await Promise.all([readJson(depsFile), readJson(mktFile)]);
  const localDirs = await findLocalSkills({ root, skillsRoot, pluginsRoot });
  const localSet = new Set(localDirs);
  const pluginOf = await skillToPlugin({
    mktFile,
    root,
    findSkills: async () => localDirs,
  });
  const depByPath = new Map();
  for (const dependency of flattenDeps(deps)) {
    const localDirectory = depLocalDir(dependency, { skillsRoot, pluginsRoot });
    depByPath.set(relPosix(localDirectory, root), dependency);
  }

  const paths = new Set([...localDirs, ...depByPath.keys()]);
  const rows = await Promise.all([...paths].sort().map(async (skillPath) => {
    const name = skillPath.split('/').pop();
    const plugin = pluginOfRelPath(skillPath) || pluginOf.get(skillPath) || '-';
    const dependency = depByPath.get(skillPath);
    const source = dependency ? formatSourceLabel(dependency) : 'local';
    const syncedAt = dependency?.resolved?.syncedAt || '';
    const repo = githubOwnerRepo(dependency?.source?.repo);
    let description = '';
    if (localSet.has(skillPath)) {
      try {
        const raw = await readFile(path.join(root, skillPath, 'SKILL.md'), 'utf8');
        description = oneLine(parseFrontmatter(raw)?.description, 100);
      } catch {
        description = '';
      }
    }
    return {
      name,
      plugin,
      source,
      repo,
      syncedAt,
      description,
      local: localSet.has(skillPath) ? 'yes' : 'no',
      path: skillPath,
    };
  }));
  const pluginRank = new Map((marketplace.plugins || []).map((plugin, index) => [plugin.name, index]));
  rows.sort((a, b) => {
    const rankA = pluginRank.has(a.plugin) ? pluginRank.get(a.plugin) : 999;
    const rankB = pluginRank.has(b.plugin) ? pluginRank.get(b.plugin) : 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

/**
 * Scope and "When" copy for the plugins table.
 * Marketplace descriptions are the source: "Install at user|project scope in|for …"
 */
export function pluginScopeAndWhen(plugin) {
  const description = String(plugin?.description || '').trim();
  const install = description.match(
    /Install at (user|project) scope(?:\s+(?:in|for)\s+(.+?))?\.?\s*$/i,
  );
  const namedScope = description.match(/\b(user|project) scope\b/i);
  const scope = (install?.[1] || namedScope?.[1] || 'project').toLowerCase();
  let when = (install?.[2] || '').trim().replace(/\.$/, '');
  if (!when) {
    when = description
      .replace(/\s*Install at (?:user|project) scope.*$/i, '')
      .replace(/\.\s*$/, '')
      .trim();
  }
  if (!when) when = `${plugin?.name || 'plugin'} repositories`;
  const firstWord = when.split(/\s+/)[0] || '';
  if (firstWord && !/[A-Z]/.test(firstWord)) {
    when = when.charAt(0).toUpperCase() + when.slice(1);
  }
  return { scope, when };
}

/** Collect marketplace plugins with local skill counts for the README plugins table. */
export async function collectPluginRows({
  root = ROOT,
  mktFile = MKT_FILE,
  skillsRoot = path.join(root, 'skills'),
  pluginsRoot = path.join(root, 'plugins'),
} = {}) {
  const marketplace = await readJson(mktFile);
  const localDirs = await findLocalSkills({ root, skillsRoot, pluginsRoot });
  const counts = new Map();
  for (const directory of localDirs) {
    const plugin = pluginOfRelPath(directory);
    if (!plugin) continue;
    counts.set(plugin, (counts.get(plugin) || 0) + 1);
  }
  return (marketplace.plugins || []).map((plugin) => {
    const { scope, when } = pluginScopeAndWhen(plugin);
    return {
      name: plugin.name,
      scope,
      when,
      skillCount: counts.get(plugin.name) || 0,
    };
  });
}

export function renderPluginsTable(rows) {
  const header = '| Plugin | Scope | When |';
  const separator = '|--------|--------|------|';
  if (rows.length === 0) return [header, separator, '| _(none)_ | | |'].join('\n');
  const body = rows.map((row) => {
    const when = row.skillCount === 0
      ? `${row.when} (placeholder, no skills yet)`
      : row.when;
    return `| ${mdCell(`**${row.name}**`)} | ${mdCell(row.scope)} | ${mdCell(when)} |`;
  });
  return [header, separator, ...body].join('\n');
}

export function renderSkillsTable(rows) {
  const header = '| Skill | Plugin | Source | Description |';
  const separator = '|-------|--------|--------|-------------|';
  if (rows.length === 0) return [header, separator, '| _(none)_ | | | |'].join('\n');
  const body = rows.map((row) => {
    const skill = row.local === 'no'
      ? `\`${row.name}\` ⚠️ missing`
      : `[\`${row.name}\`](${row.path})`;
    return `| ${mdCell(skill)} | ${mdCell(row.plugin)} | ${mdCell(sourceRepoLink(row.repo))} | ${mdCell(row.description)} |`;
  });
  return [header, separator, ...body].join('\n');
}

export async function updateReadmeTables({
  checkOnly = false,
  quiet = false,
  readmeFile = README_FILE,
  ...rowOptions
} = {}) {
  const [skillRows, pluginRows] = await Promise.all([
    collectSkillRows(rowOptions),
    collectPluginRows(rowOptions),
  ]);
  let readme;
  try {
    readme = await readFile(readmeFile, 'utf8');
  } catch (error) {
    throw new Error(`README.md unreadable: ${error.message}`);
  }
  const plugins = replaceMarkedBlock(readme, PLUGIN_START, PLUGIN_END, renderPluginsTable(pluginRows));
  const skills = replaceMarkedBlock(
    plugins.missing ? readme : plugins.next,
    README_START,
    README_END,
    renderSkillsTable(skillRows),
  );
  const missingMarkers = plugins.missing || skills.missing;
  const changed = !missingMarkers && (plugins.changed || skills.changed);
  const result = {
    changed: missingMarkers || changed,
    count: skillRows.length,
    pluginCount: pluginRows.length,
    missingMarkers,
    missingPluginMarkers: plugins.missing,
    missingSkillMarkers: skills.missing,
  };
  if (missingMarkers || checkOnly || !changed) return result;
  await writeFile(readmeFile, skills.next, 'utf8');
  if (!quiet) {
    log.success(`README tables updated (${pluginRows.length} plugin(s), ${skillRows.length} skill(s))`);
  }
  return { ...result, changed: true };
}

export const updateReadmeSkillsTable = updateReadmeTables;

function missingMarkerMessage(result) {
  const parts = [];
  if (result.missingPluginMarkers) parts.push('<!-- plugins:table:start --> / <!-- plugins:table:end -->');
  if (result.missingSkillMarkers) parts.push('<!-- skills:table:start --> / <!-- skills:table:end -->');
  return `README.md missing ${parts.join(' and ') || 'table'} markers`;
}

export async function refreshReadme({ quiet = true, ...options } = {}) {
  const result = await updateReadmeTables({ quiet, ...options });
  if (result.missingMarkers) throw new Error(missingMarkerMessage(result));
  if (result.changed && quiet) {
    log.success(`README tables updated (${result.pluginCount} plugin(s), ${result.count} skill(s))`);
  }
  return result;
}

export async function listCollected({ mktFile = MKT_FILE, ...options } = {}) {
  const marketplace = await readJson(mktFile);
  const rows = await collectSkillRows({ mktFile, ...options });
  printSection('All skills', formatSkillList(rows, {
    pluginOrder: (marketplace.plugins || []).map((plugin) => plugin.name),
  }));
  return true;
}
