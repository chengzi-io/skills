import {
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  DEPS_FILE,
  MKT_FILE,
  ROOT,
  destFor,
  depLocalDir,
  exists,
  localNameOf,
  readJson,
  relPosix,
  safeName,
  writeJson,
  pluginSkillsDir,
  makeResolved,
} from './workspace.mjs';
import {
  discoverSkills,
  downloadSkill,
  findLocalSkills,
} from './skills.mjs';
import {
  ensurePlugin,
  flattenDeps,
  formatSourceLabel,
  knownRepos,
  loadGroups,
  moveInMarketplace,
  removeDependencyDirs,
  removeFromMarketplace,
  renameSkillTo,
  upsertDependency,
  pluginOfRelPath,
} from './catalog.mjs';
import {
  formatSkillList,
  printSection,
  refreshReadme,
  listCollected as listCollectedRows,
  truncate,
} from './readme.mjs';
import {
  getDefaultBranch,
  parseRepo,
  resolveCommitSha,
} from './github.mjs';
import {
  buildChecklist,
  reinstallFromDep,
  syncToLocal,
} from './sync.mjs';
import { validateAll } from './validate.mjs';

export async function withSpinner(startMessage, fn, doneMessage) {
  const progress = spinner();
  progress.start(startMessage);
  try {
    const result = await fn((message) => progress.message(message));
    const message = typeof doneMessage === 'function'
      ? doneMessage(result)
      : (doneMessage ?? startMessage);
    progress.stop(message);
    return result;
  } catch (error) {
    progress.stop(error.message, 1);
    throw error;
  }
}

/** Pick an existing plugin or create a new one; null on cancellation. */
export async function selectGroup(message) {
  const existingGroups = await loadGroups();
  const choice = await select({
    message,
    options: [
      ...existingGroups.map((group) => ({ value: group, label: group })),
      { value: '__new__', label: 'New plugin…' },
    ],
  });
  if (isCancel(choice)) return null;
  if (choice !== '__new__') return choice;
  const name = await text({
    message: 'New plugin name?',
    placeholder: 'e.g. qa, data, backend',
    validate: (value) => (/^[a-z0-9-]+$/.test(value.trim()) ? undefined : 'Use a-z, 0-9, and - only'),
  });
  if (isCancel(name)) return null;
  return name.trim();
}

export async function collectSkill() {
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
      options: [...repoOptions, { value: '__new__', label: 'Type a new repo…' }],
    });
    if (isCancel(choice)) return false;
    if (choice !== '__new__') repoInput = choice;
  }
  if (repoInput === null) {
    repoInput = await text({
      message: 'Source repo (owner/repo)?',
      placeholder: 'emilkowalski/skills',
      validate: (value) => (parseRepo(value) ? undefined : 'Use owner/repo, e.g. emilkowalski/skills'),
    });
    if (isCancel(repoInput)) return false;
  }
  const parsed = parseRepo(repoInput);
  if (!parsed) return false;
  const { owner, repo } = parsed;

  let defaultBranch;
  try {
    defaultBranch = await withSpinner(
      'Connecting to GitHub…',
      () => getDefaultBranch(owner, repo),
      (branch) => `${owner}/${repo} @ ${branch}`,
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
  for (const skill of skills) {
    (byGroup[skill.group] ||= []).push({
      value: skill.root,
      label: skill.name,
      hint: truncate(skill.description),
    });
  }
  const picked = await groupMultiselect({
    message: 'Pick skills (space to toggle, enter to confirm)',
    options: byGroup,
    required: false,
  });
  if (isCancel(picked)) return false;
  const selected = skills.filter((skill) => picked.includes(skill.root));
  if (selected.length === 0) {
    log.warn('No skill selected');
    return false;
  }
  const pluginName = await selectGroup('Which plugin?');
  if (pluginName === null) return false;

  const planned = selected.map((skill) => ({ skill, name: safeName(skill.name) }));
  const existingNames = new Set((await findLocalSkills()).map((directory) => directory.split('/').pop()));
  const conflicts = [];
  for (const plan of planned) {
    if (existingNames.has(plan.name) || await exists(destFor(pluginName, plan.name))) conflicts.push(plan.name);
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
  let marketplace;
  try {
    deps = await readJson(DEPS_FILE);
    marketplace = await readJson(MKT_FILE);
  } catch (error) {
    log.error(`Failed to read config: ${error.message}`);
    return false;
  }
  const results = [];
  try {
    await withSpinner('Downloading…', async (message) => {
      for (const { skill, name } of planned) {
        message(`Download ${name}…`);
        await mkdir(pluginSkillsDir(pluginName), { recursive: true });
        await downloadSkill({
          owner,
          repo,
          ref,
          files: skill.files,
          root: skill.root,
          dest: destFor(pluginName, name),
        });
        ensurePlugin(marketplace, pluginName);
        const sha = await resolveCommitSha(owner, repo, ref);
        const added = upsertDependency(deps, {
          type: 'skill',
          source: { repo: `${owner}/${repo}`, path: skill.root, branch: ref },
          resolved: makeResolved(sha),
          target: { plugin: pluginName, name },
        });
        results.push({ name, files: skill.files.length, group: pluginName, added, sha });
      }
      await writeJson(DEPS_FILE, deps);
      await writeJson(MKT_FILE, marketplace);
    }, `Added ${planned.length} skill(s)`);
  } catch (error) {
    log.error(error.message);
    return false;
  }
  printSection('Done', formatSkillList(results.map((result) => ({
    name: result.name + (result.added ? '' : '  (updated)'),
    plugin: result.group,
    source: 'new',
    local: 'yes',
    path: relPosix(destFor(result.group, result.name)),
  })), { pluginOrder: [...new Set(results.map((result) => result.group))] }));
  await refreshReadme();
  log.message('Tip: claude plugin validate .claude-plugin/marketplace.json');
  return true;
}

export async function checkUpstream() {
  const deps = await readJson(DEPS_FILE);
  const entries = flattenDeps(deps);
  if (entries.length === 0) {
    log.info('No third-party skills in dependencies.json');
    return true;
  }
  try {
    const items = await withSpinner(
      `Checking ${entries.length} skill(s)…`,
      () => buildChecklist(entries),
      (list) => {
        const outdated = list.filter((item) => item.status === 'outdated').length;
        const missing = list.filter((item) => item.status === 'missing').length;
        const errors = list.filter((item) => item.status === 'error').length;
        return `Done: ${outdated} update(s), ${missing} missing, ${errors} error(s)`;
      },
    );
    for (const item of items) {
      const name = localNameOf(item.dep);
      if (item.status === 'fresh') log.success(`${name}: up to date (latest @ ${item.r && item.r.sha ? item.r.sha.slice(0, 7) : ''})`);
      else if (item.status === 'outdated') log.warn(`${name}: ${item.r.remoteOnly.length} new / ${item.r.changed} changed (latest @ ${item.r.sha.slice(0, 7)})`);
      else if (item.status === 'missing') log.warn(`${name}: missing on disk`);
      else log.error(`${name}: check failed (${item.error})`);
    }
    return true;
  } catch (error) {
    log.error(error.message);
    return false;
  }
}

export async function manageCollected() {
  const deps = await readJson(DEPS_FILE);
  const entries = flattenDeps(deps);
  const localDirs = await findLocalSkills();

  const depByDir = new Map();
  for (const dependency of entries) depByDir.set(relPosix(depLocalDir(dependency)), dependency);
  const allDirs = [...new Set([...localDirs, ...depByDir.keys()])].sort();
  if (allDirs.length === 0) {
    log.info('No skills yet. Use "Add skill" first.');
    return false;
  }

  const pluginNames = new Set(await loadGroups());
  for (const directory of allDirs) {
    const plugin = pluginOfRelPath(directory) || depByDir.get(directory)?.target?.plugin;
    if (plugin) pluginNames.add(plugin);
  }
  const plugin = await select({
    message: 'Which plugin do you want to manage?',
    options: [
      { value: '__all__', label: 'All plugins' },
      ...[...pluginNames].sort().map((name) => ({ value: name, label: name })),
      ...(allDirs.some((directory) => !pluginOfRelPath(directory) && !depByDir.get(directory)?.target?.plugin)
        ? [{ value: '__none__', label: '(no plugin)' }]
        : []),
    ],
  });
  if (isCancel(plugin)) return false;
  const directories = allDirs.filter((directory) => {
    if (plugin === '__all__') return true;
    const itemPlugin = pluginOfRelPath(directory) || depByDir.get(directory)?.target?.plugin;
    return plugin === '__none__' ? !itemPlugin : itemPlugin === plugin;
  });
  if (directories.length === 0) {
    log.info('No skills in the selected plugin.');
    return false;
  }

  const byDir = new Map(directories.map((directory) => [directory, {
    name: directory.split('/').pop(),
    dir: directory,
    dep: depByDir.get(directory) || null,
    status: depByDir.has(directory) ? 'unknown' : 'local',
    r: null,
    error: null,
  }]));
  const all = [...byDir.values()];
  const outdated = all.filter((item) => item.status === 'outdated');
  const fresh = all.filter((item) => item.status === 'fresh');
  const missing = all.filter((item) => item.status === 'missing');
  const errors = all.filter((item) => item.status === 'error');
  for (const item of errors) log.error(`${item.name}: check failed (${item.error})`);
  if (outdated.length > 0) {
    log.warn(`^ ${outdated.length} update(s): ${outdated.map((item) => `${item.name}(+${item.r.remoteOnly.length}/~${item.r.changed})`).join(', ')}`);
  }
  if (missing.length > 0) log.warn(`x ${missing.length} missing: ${missing.map((item) => item.name).join(', ')}`);
  if (fresh.length > 0) log.success(`${fresh.length} up to date`);

  const options = all.map((item) => {
    const prefix = item.status === 'outdated'
      ? '^ '
      : item.status === 'missing'
        ? 'x '
        : item.status === 'error'
          ? '? '
          : '  ';
    let hint = item.status === 'local' ? 'local skill' : formatSourceLabel(item.dep);
    if (item.status === 'outdated') hint = `+${item.r.remoteOnly.length} new / ${item.r.changed} changed @ ${item.r.sha.slice(0, 8)}`;
    else if (item.status === 'fresh') hint = `${item.r.total} file(s), latest @ ${item.r.sha.slice(0, 8)}`;
    else if (item.status === 'missing') hint = 'missing on disk';
    else if (item.status === 'error') hint = 'check failed';
    return { value: item.name, label: `${prefix}${item.name}`, hint };
  });

  const byName = new Map(all.map((item) => [item.name, item]));
  const picked = await multiselect({
    message: 'Pick skills (space to toggle, enter to confirm)',
    options,
    initialValues: outdated.map((item) => item.name),
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
      { value: 'reinstall', label: 'Reinstall from upstream', hint: 'replace all tracked files' },
      { value: 'rename', label: 'Rename', hint: 'dir + SKILL.md + registry' },
      { value: 'plugin', label: 'Change plugin', hint: 'move to another plugin' },
      { value: 'remove', label: 'Remove', hint: 'delete local + registry (cannot undo)' },
      { value: 'cancel', label: 'Cancel' },
    ],
  });
  if (isCancel(action) || action === 'cancel') {
    log.warn('Cancelled');
    return false;
  }

  if (action === 'sync') {
    const selectedItems = picked.map((name) => byName.get(name)).filter(Boolean);
    const unchecked = selectedItems
      .map((item) => item.dep)
      .filter((dependency) => dependency && byDir.get(relPosix(depLocalDir(dependency)))?.status === 'unknown');
    if (unchecked.length > 0) {
      try {
        const checkedItems = await withSpinner(
          `Checking ${unchecked.length} selected skill(s)…`,
          () => buildChecklist(unchecked),
          'Check complete',
        );
        for (const { dep, status, r, error } of checkedItems) {
          const item = byDir.get(relPosix(depLocalDir(dep)));
          if (!item) continue;
          item.status = status;
          item.r = r;
          item.error = error || null;
        }
      } catch (error) {
        log.error(error.message);
        return false;
      }
    }
    const toSync = selectedItems.filter((item) => item.status === 'outdated');
    const skipped = picked.length - toSync.length;
    if (toSync.length === 0) {
      log.info('All selected skills are already up to date');
      return true;
    }
    if (skipped > 0) log.message(`Skip ${skipped} skill(s) without updates`);
    const confirmed = await confirm({
      message: `Sync ${toSync.length} skill(s) (overwrite local files)?`,
      initialValue: true,
    });
    if (isCancel(confirmed) || !confirmed) {
      log.warn('Cancelled');
      return true;
    }
    try {
      await withSpinner('Syncing…', async (message) => {
        for (const item of toSync) {
          message(`Sync ${item.name}…`);
          await syncToLocal(item.r, item.dep);
        }
        await writeJson(DEPS_FILE, deps);
      }, `Synced ${toSync.length} skill(s)`);
    } catch (error) {
      log.error(error.message);
      return false;
    }
    await refreshReadme();
    return true;
  }

  if (action === 'reinstall') {
    const selectedItems = picked.map((name) => byName.get(name)).filter(Boolean);
    const reinstallable = selectedItems.filter((item) => item.dep);
    const skipped = selectedItems.length - reinstallable.length;
    if (reinstallable.length === 0) {
      log.info('No selected skills are registered upstream');
      return true;
    }
    if (skipped > 0) log.message(`Skip ${skipped} local-only skill(s)`);
    const confirmed = await confirm({
      message: `Reinstall ${reinstallable.length} skill(s) (replace tracked files)?`,
      initialValue: false,
    });
    if (isCancel(confirmed) || !confirmed) {
      log.warn('Cancelled');
      return true;
    }
    try {
      await withSpinner('Reinstalling…', async (message) => {
        for (const item of reinstallable) {
          message(`Reinstall ${item.name}…`);
          await reinstallFromDep(item.dep);
        }
        await writeJson(DEPS_FILE, deps);
      }, `Reinstalled ${reinstallable.length} skill(s)`);
    } catch (error) {
      log.error(error.message);
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
      validate: (value) => {
        const name = value.trim();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return 'Use lowercase letters, numbers, and single hyphens only';
        if (name === item.name) return 'Name unchanged';
        return undefined;
      },
    });
    if (isCancel(newName)) return false;
    const name = newName.trim();
    const newDir = `${item.dir.slice(0, item.dir.lastIndexOf('/'))}/${name}`;
    if (await exists(path.join(ROOT, newDir))) {
      log.error(`Already exists: ${newDir}`);
      return true;
    }
    const confirmed = await confirm({
      message: `Rename ${item.name} → ${name}? (dir + SKILL.md + registry)`,
      initialValue: true,
    });
    if (isCancel(confirmed) || !confirmed) {
      log.warn('Cancelled');
      return true;
    }
    try {
      await withSpinner('Renaming…', async () => renameSkillTo(item, name, deps), `Renamed ${item.name} → ${name}`);
    } catch (error) {
      log.error(error.message);
      return false;
    }
    await refreshReadme();
    return true;
  }

  if (action === 'plugin') {
    const pluginName = await selectGroup('Which plugin?');
    if (pluginName === null) return false;
    try {
      await withSpinner('Moving…', async () => {
        const marketplace = await readJson(MKT_FILE);
        await mkdir(pluginSkillsDir(pluginName), { recursive: true });
        for (const name of picked) {
          const item = byName.get(name);
          const destination = destFor(pluginName, item.name);
          const source = path.join(ROOT, item.dir);
          if (path.resolve(source) !== path.resolve(destination)) {
            if (await exists(destination)) throw new Error(`Already exists: ${relPosix(destination)}`);
            await rename(source, destination);
          }
          moveInMarketplace(marketplace, `./${item.dir}`, pluginName);
          if (item.dep) item.dep.target.plugin = pluginName;
        }
        await writeJson(MKT_FILE, marketplace);
        await writeJson(DEPS_FILE, deps);
      }, `Moved ${picked.length} skill(s) to ${pluginName}`);
    } catch (error) {
      log.error(error.message);
      return false;
    }
    await refreshReadme();
    return true;
  }

  const confirmed = await confirm({
    message: `Delete ${picked.length} skill(s) (${picked.join(', ')})? Cannot undo`,
    initialValue: false,
  });
  if (isCancel(confirmed) || !confirmed) {
    log.warn('Cancelled');
    return false;
  }
  try {
    await withSpinner('Removing…', async (message) => {
      const marketplace = await readJson(MKT_FILE);
      const pickedDirs = new Set(picked.map((name) => byName.get(name).dir));
      for (const name of picked) {
        const item = byName.get(name);
        message(`Remove ${name}…`);
        await rm(path.join(ROOT, item.dir), { recursive: true, force: true });
        removeFromMarketplace(marketplace, `./${item.dir}`);
      }
      removeDependencyDirs(deps, pickedDirs);
      await writeJson(DEPS_FILE, deps);
      await writeJson(MKT_FILE, marketplace);
    }, `Removed ${picked.length} skill(s)`);
  } catch (error) {
    log.error(error.message);
    return false;
  }
  await refreshReadme();
  return true;
}

export async function listCollected() {
  return listCollectedRows();
}

export async function main() {
  intro('chengzi-skills');
  const actions = {
    collect: collectSkill,
    manage: manageCollected,
    check: checkUpstream,
    list: listCollected,
    validate: validateAll,
  };
  while (true) {
    const action = await select({
      message: 'What do you want to do?',
      options: [
        { value: 'collect', label: 'Add skill', hint: 'from GitHub' },
        { value: 'manage', label: 'Manage skills', hint: 'sync or remove' },
        { value: 'check', label: 'Check upstream for updates', hint: 'read-only status check' },
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
    } catch (error) {
      log.error(`Unexpected error: ${error.message}`);
    }
  }
}
