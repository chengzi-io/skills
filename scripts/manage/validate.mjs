import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { log } from '@clack/prompts';
import {
  DEPS_FILE,
  MKT_FILE,
  README_FILE,
  ROOT,
  depLocalDir,
  exists,
  localNameOf,
  readJson,
  relPosix,
} from './workspace.mjs';
import {
  findLocalSkills,
  parseFrontmatter,
} from './skills.mjs';
import { pluginOfRelPath, sourceSig } from './catalog.mjs';
import { updateReadmeSkillsTable } from './readme.mjs';

/** Validate dependencies, marketplace entries, frontmatter, and README tables. */
export async function validateAll({
  root = ROOT,
  depsFile = DEPS_FILE,
  mktFile = MKT_FILE,
  readmeFile = README_FILE,
  skillsRoot = path.join(root, 'skills'),
  pluginsRoot = path.join(root, 'plugins'),
} = {}) {
  let errors = 0;
  const reportError = (message) => {
    log.error(message);
    errors += 1;
  };
  const section = async (label, fn) => {
    const before = errors;
    try {
      await fn();
    } catch (error) {
      reportError(`${label}: ${error.message}`);
    }
    if (errors === before) log.success(label);
  };
  const localDirs = await findLocalSkills({ root, skillsRoot, pluginsRoot });

  await section('dependencies.json ok', async () => {
    const deps = await readJson(depsFile);
    if (deps.version !== 2) reportError('dependencies.json: version must be 2');
    if (!Array.isArray(deps.sources)) reportError('dependencies.json: sources must be an array');
    const seenSources = new Set();
    for (const source of deps.sources ?? []) {
      if (!source.repo) {
        reportError(`Missing source.repo: ${JSON.stringify(source)}`);
        continue;
      }
      const refs = ['branch', 'tag', 'release'].filter((key) => source[key]);
      if (refs.length > 1) reportError(`${source.repo}: use only one of branch/tag/release`);
      const signature = sourceSig(source);
      if (seenSources.has(signature)) {
        reportError(`${source.repo}: duplicate source block (${refs.join('/') || 'default ref'})`);
      }
      seenSources.add(signature);
      if ((source.items ?? []).length === 0) reportError(`${source.repo}: source block has no items`);
      if (!source.resolved?.sha) {
        reportError(`${source.repo}: missing resolved.sha (run pnpm sync to pin)`);
      } else if (!/^[0-9a-f]{40}$/.test(source.resolved.sha)) {
        reportError(`${source.repo}: resolved.sha must be a 40-char hex commit`);
      }
      if (!source.resolved?.syncedAt) {
        reportError(`${source.repo}: missing resolved.syncedAt`);
      } else if (Number.isNaN(Date.parse(source.resolved.syncedAt))) {
        reportError(`${source.repo}: resolved.syncedAt is not a valid date`);
      }
      const seenPaths = new Set();
      for (const item of source.items ?? []) {
        const label = `${source.repo}:${item.path}`;
        if (!['skill', 'agent'].includes(item.type)) reportError(`Bad type on ${label}: ${JSON.stringify(item)}`);
        if (!item.path) reportError(`Missing item.path under ${source.repo}: ${JSON.stringify(item)}`);
        if (!item.target?.plugin) reportError(`Missing target.plugin on ${label}`);
        if (seenPaths.has(item.path)) reportError(`${label}: duplicate item path in source block`);
        seenPaths.add(item.path);
        const name = localNameOf({ source: { path: item.path }, target: item.target });
        const expected = relPosix(depLocalDir({ source: { path: item.path }, target: item.target }, {
          skillsRoot,
          pluginsRoot,
        }), root);
        const actual = localDirs.find((directory) => directory.split('/').pop() === name);
        if (actual && actual !== expected) {
          reportError(`${name}: on disk at ${actual}, dependencies.json target.plugin is ${item.target?.plugin}`);
        }
      }
    }
  });

  await section('marketplace.json ok', async () => {
    const marketplace = await readJson(mktFile);
    const names = new Set();
    for (const plugin of marketplace.plugins ?? []) {
      if (!plugin.name) {
        reportError('marketplace plugin missing name');
        continue;
      }
      if (names.has(plugin.name)) reportError(`duplicate plugin: ${plugin.name}`);
      names.add(plugin.name);
      const source = typeof plugin.source === 'string' ? plugin.source : plugin.source?.path;
      if (!source) {
        reportError(`${plugin.name}: missing source`);
        continue;
      }
      const pluginRoot = path.join(root, source);
      if (!(await exists(pluginRoot))) {
        reportError(`${plugin.name}: source not found: ${source}`);
      }
      for (const skill of plugin.skills ?? []) {
        const relative = skill.replace(/^\.\//, '');
        const underPlugin = path.join(pluginRoot, relative);
        const underRepo = path.join(root, relative);
        if (!(await exists(path.join(underPlugin, 'SKILL.md')))
          && !(await exists(path.join(underRepo, 'SKILL.md')))) {
          reportError(`marketplace.json: ${plugin.name} skill ${skill} missing or no SKILL.md`);
        }
      }
    }
    for (const directory of localDirs) {
      if (directory.startsWith('skills/')) {
        reportError(`${directory} still under skills/; move it into plugins/<name>/skills/`);
        continue;
      }
      const plugin = pluginOfRelPath(directory);
      if (!plugin) reportError(`${directory} is not under plugins/<name>/skills/`);
      else if (!names.has(plugin)) reportError(`${directory}: plugin ${plugin} is not in marketplace.json`);
    }
  });

  await section('SKILL.md frontmatter ok', async () => {
    for (const directory of localDirs) {
      const raw = await readFile(path.join(root, directory, 'SKILL.md'), 'utf8');
      const frontmatter = parseFrontmatter(raw);
      if (!frontmatter) {
        reportError(`${directory}/SKILL.md: missing frontmatter`);
        continue;
      }
      if (!frontmatter.name) reportError(`${directory}/SKILL.md: missing name`);
      if (!frontmatter.description) reportError(`${directory}/SKILL.md: missing description`);
    }
  });

  await section('README tables ok', async () => {
    const result = await updateReadmeSkillsTable({
      checkOnly: true,
      readmeFile,
      root,
      depsFile,
      mktFile,
      skillsRoot,
      pluginsRoot,
    });
    if (result.missingPluginMarkers) {
      reportError('README.md missing <!-- plugins:table:start --> / <!-- plugins:table:end --> markers');
    }
    if (result.missingSkillMarkers) {
      reportError('README.md missing <!-- skills:table:start --> / <!-- skills:table:end --> markers');
    }
    if (!result.missingMarkers && result.changed) {
      reportError('README tables are stale — run: pnpm readme');
    }
  });

  log.message(errors === 0 ? 'All checks passed' : `${errors} problem(s)`);
  return errors === 0;
}
