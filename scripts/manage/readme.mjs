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

export const truncate = (value, length = 60) => {
  const string = String(value);
  return string.length > length ? `${string.slice(0, length)}…` : string;
};

export const oneLine = (value, length = 100) => truncate(
  String(value || '').replace(/\s+/g, ' ').trim(),
  length,
);

export const mdCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

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
  const deps = await readJson(depsFile);
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
      syncedAt,
      description,
      local: localSet.has(skillPath) ? 'yes' : 'no',
      path: skillPath,
    };
  }));

  const marketplace = await readJson(mktFile);
  const pluginRank = new Map((marketplace.plugins || []).map((plugin, index) => [plugin.name, index]));
  rows.sort((a, b) => {
    const rankA = pluginRank.has(a.plugin) ? pluginRank.get(a.plugin) : 999;
    const rankB = pluginRank.has(b.plugin) ? pluginRank.get(b.plugin) : 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

export function renderSkillsTable(rows) {
  const header = '| Skill | Plugin | Description |';
  const separator = '|-------|--------|-------------|';
  if (rows.length === 0) return [header, separator, '| _(none)_ | | |'].join('\n');
  const body = rows.map((row) => {
    const skill = row.local === 'no'
      ? `\`${row.name}\` ⚠️ missing`
      : `[\`${row.name}\`](${row.path})`;
    return `| ${mdCell(skill)} | ${mdCell(row.plugin)} | ${mdCell(row.description)} |`;
  });
  return [header, separator, ...body].join('\n');
}

export async function updateReadmeSkillsTable({
  checkOnly = false,
  quiet = false,
  readmeFile = README_FILE,
  ...rowOptions
} = {}) {
  const rows = await collectSkillRows(rowOptions);
  const table = renderSkillsTable(rows);
  const block = `${README_START}\n\n${table}\n\n${README_END}`;
  let readme;
  try {
    readme = await readFile(readmeFile, 'utf8');
  } catch (error) {
    throw new Error(`README.md unreadable: ${error.message}`);
  }
  if (!readme.includes(README_START) || !readme.includes(README_END)) {
    return { changed: true, count: rows.length, missingMarkers: true };
  }
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(`${escape(README_START)}[\\s\\S]*?${escape(README_END)}`);
  const next = readme.replace(expression, () => block);
  const changed = next !== readme;
  if (checkOnly || !changed) return { changed, count: rows.length };
  await writeFile(readmeFile, next, 'utf8');
  if (!quiet) log.success(`README skills table updated (${rows.length} skill(s))`);
  return { changed: true, count: rows.length };
}

export async function refreshReadme({ quiet = true, ...options } = {}) {
  const result = await updateReadmeSkillsTable({ quiet, ...options });
  if (result.missingMarkers) {
    throw new Error('README.md missing <!-- skills:table:start --> / <!-- skills:table:end --> markers');
  }
  if (result.changed && quiet) log.success(`README skills table updated (${result.count})`);
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
