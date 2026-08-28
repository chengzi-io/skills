import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { log } from '@clack/prompts';
import {
  CONCURRENCY,
  fetchRaw as defaultFetchRaw,
  getTree as defaultGetTree,
  mapPool,
  resolveCommitSha as defaultResolveCommitSha,
} from './github.mjs';
import {
  DEPS_FILE,
  depLocalDir,
  localNameOf,
  makeResolved,
  readJson,
  shortSha,
  writeJson,
} from './workspace.mjs';
import {
  downloadSkill,
  isIgnoredFile,
  walkLocal,
} from './skills.mjs';
import { flattenDeps } from './catalog.mjs';
import { updateReadmeSkillsTable } from './readme.mjs';

function remoteMethods(remote = {}) {
  remote ||= {};
  const getTree = remote.getTree
    ? (...args) => remote.getTree(...args)
    : defaultGetTree;
  const fetchRaw = remote.fetchRaw
    ? (...args) => remote.fetchRaw(...args)
    : defaultFetchRaw;
  const resolveCommitSha = remote.resolveCommitSha
    ? (...args) => remote.resolveCommitSha(...args)
    : defaultResolveCommitSha;
  return {
    getTree,
    fetchRaw,
    resolveCommitSha,
  };
}

function treeBlobs(tree) {
  const entries = Array.isArray(tree) ? tree : tree?.tree || [];
  return entries
    .map((entry) => (typeof entry === 'string' ? { type: 'blob', path: entry } : entry))
    .filter((entry) => entry && typeof entry.path === 'string'
      && (!entry.type || entry.type === 'blob'));
}

/** Diff a local skill directory against the relevant upstream files. */
export async function compareWithUpstream(dep, { remote = {}, destination } = {}) {
  const [owner, repo] = dep.source.repo.split('/');
  const ref = dep.source.branch || dep.source.tag || dep.source.release;
  if (!ref) throw new Error(`${dep.source.repo}: missing branch/tag/release`);

  const name = localNameOf(dep);
  const localDir = destination || depLocalDir(dep);
  const localFiles = await walkLocal(localDir).catch(() => null);
  if (localFiles === null) return { missing: true, localName: name };

  const { getTree, fetchRaw, resolveCommitSha } = remoteMethods(remote);
  const blobs = treeBlobs(await getTree(owner, repo, ref));
  const prefix = dep.source.path === '.' ? '' : `${dep.source.path}/`;
  const upstreamFiles = blobs
    .filter((entry) => entry.path.startsWith(prefix) && entry.path !== prefix.replace(/\/$/, ''))
    .map((entry) => entry.path.slice(prefix.length))
    .filter(Boolean)
    .filter((file) => !isIgnoredFile(file, dep.ignore));

  const relevantLocalFiles = localFiles.filter((file) => !isIgnoredFile(file, dep.ignore));
  const remoteOnly = upstreamFiles.filter((file) => !relevantLocalFiles.includes(file));
  const localOnly = relevantLocalFiles.filter((file) => !upstreamFiles.includes(file));

  const common = upstreamFiles.filter((file) => relevantLocalFiles.includes(file));
  const changedFiles = [];
  await mapPool(common, CONCURRENCY, async (file) => {
    const upstream = await fetchRaw(owner, repo, ref, prefix + file);
    const local = await readFile(path.join(localDir, ...file.split('/')), 'utf8').catch(() => null);
    if (local !== upstream) changedFiles.push(file);
  });

  const sha = await resolveCommitSha(owner, repo, ref);
  changedFiles.sort();
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

/** Build a status checklist for each registered dependency. */
export async function buildChecklist(entries, { remote = {} } = {}) {
  return mapPool(entries, Math.min(3, entries.length || 1), async (dep) => {
    try {
      const result = await compareWithUpstream(dep, { remote });
      if (result.missing) return { dep, status: 'missing', r: null };
      if (result.changed > 0 || result.remoteOnly.length > 0) {
        return { dep, status: 'outdated', r: result };
      }
      return { dep, status: 'fresh', r: result };
    } catch (error) {
      return { dep, status: 'error', r: null, error: error.message };
    }
  });
}

/** Apply only new/changed files, retaining local-only files. */
export async function syncToLocal(r, dep, { quiet = false, remote = {}, destination } = {}) {
  const [owner, repo] = dep.source.repo.split('/');
  const ref = dep.source.branch || dep.source.tag || dep.source.release;
  const prefix = dep.source.path === '.' ? '' : `${dep.source.path}/`;
  const localDir = destination || depLocalDir(dep);
  const { fetchRaw } = remoteMethods(remote);
  const files = [...r.remoteOnly, ...r.changedFiles];
  for (const file of files) {
    const content = await fetchRaw(owner, repo, ref, prefix + file);
    const target = path.join(localDir, ...file.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  dep.resolved = makeResolved(r.sha);
  const message = `${r.localName}: synced ${files.length} file(s) (@ ${shortSha(r.sha)})`;
  if (quiet) console.log(`  ok  ${message}`);
  else log.success(message);
  if (r.localOnly.length > 0) {
    const warning = `${r.localName}: kept local-only files: ${r.localOnly.join(', ')}`;
    if (quiet) console.warn(`  warn  ${warning}`);
    else log.warn(warning);
  }
}

/**
 * Fully reinstall a dependency. Every upstream file is downloaded into a
 * temporary directory first; the existing destination is replaced only after
 * all downloads succeed. Ignored local files are deliberately not restored.
 *
 * @param {object} dep flattened dependency entry
 * @param {{quiet?: boolean, destination?: string, remote?: {getTree?: Function, fetchRaw?: Function, resolveCommitSha?: Function}}} [options]
 */
export async function reinstallFromDep(dep, {
  quiet = false,
  destination,
  remote = {},
} = {}) {
  const [owner, repo] = dep.source.repo.split('/');
  const ref = dep.source.branch || dep.source.tag || dep.source.release;
  if (!ref) throw new Error(`${dep.source.repo}: missing branch/tag/release`);
  const name = localNameOf(dep);
  const root = dep.source.path;
  const { getTree, resolveCommitSha } = remoteMethods(remote);
  const blobs = treeBlobs(await getTree(owner, repo, ref));
  const files = root === '.'
    ? blobs.filter((entry) => entry.path === 'SKILL.md').map((entry) => entry.path)
    : blobs.filter((entry) => entry.path.startsWith(`${root}/`)).map((entry) => entry.path);
  const filteredFiles = files.filter((file) => {
    const relative = root === '.' ? file : file.slice(root.length + 1);
    return !isIgnoredFile(relative, dep.ignore);
  });
  if (filteredFiles.length === 0) {
    throw new Error(`${name}: no files under ${root} in ${owner}/${repo}@${ref}`);
  }

  // Resolve the pin before touching the destination; a failed API request is
  // therefore also non-destructive.
  const sha = await resolveCommitSha(owner, repo, ref);
  const dest = destination || depLocalDir(dep);
  await downloadSkill({
    owner,
    repo,
    ref,
    files: filteredFiles,
    root,
    dest,
    remote,
  });
  dep.resolved = makeResolved(sha);
  const message = `${name}: reinstalled ${filteredFiles.length} file(s) from ${owner}/${repo}@${ref}#${shortSha(sha)}`;
  if (quiet) console.log(`  ok  ${message}`);
  else log.success(message);
  return { localName: name, sha };
}

/** Non-interactive sync for CI and scripts. */
export async function syncAll({ checkOnly = false, remote = {} } = {}) {
  const deps = await readJson(DEPS_FILE);
  const entries = flattenDeps(deps);
  if (entries.length === 0) {
    console.log('No third-party skills in dependencies.json');
    return { ok: true, fresh: 0, synced: 0, missing: 0, errors: 0, details: [] };
  }

  console.log(`Checking ${entries.length} skill(s) against upstream…`);
  const items = await buildChecklist(entries, { remote });
  const details = items.map((item) => ({
    name: localNameOf(item.dep),
    status: item.status,
    error: item.error,
    changed: item.r?.changed,
    remoteOnly: item.r?.remoteOnly?.length,
    sha: item.r?.sha?.slice(0, 8),
  }));
  const fresh = items.filter((item) => item.status === 'fresh');
  const outdated = items.filter((item) => item.status === 'outdated');
  const missing = items.filter((item) => item.status === 'missing');
  const errors = items.filter((item) => item.status === 'error');

  for (const item of fresh) {
    const pin = item.dep.resolved?.sha ? shortSha(item.dep.resolved.sha) : 'unpinned';
    const tip = item.r?.sha ? shortSha(item.r.sha) : '?';
    console.log(`  =  ${localNameOf(item.dep)}  up to date  pin ${pin}  tip ${tip}`);
  }
  for (const item of outdated) {
    const pin = item.dep.resolved?.sha ? shortSha(item.dep.resolved.sha) : 'unpinned';
    console.log(
      `  ^  ${item.r.localName}  +${item.r.remoteOnly.length} new / ${item.r.changed} changed  pin ${pin} → tip ${shortSha(item.r.sha)}`,
    );
  }
  for (const item of missing) console.log(`  x  ${localNameOf(item.dep)}  missing on disk`);
  for (const item of errors) console.error(`  !  ${localNameOf(item.dep)}  ${item.error}`);

  if (checkOnly) {
    const unpinned = entries.filter((dep) => !dep.resolved?.sha).length;
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
  let failures = errors.length;
  let pinned = 0;
  const toFix = [...outdated, ...missing];
  for (const item of fresh) {
    if (item.r?.sha && (!item.dep.resolved?.sha || !item.dep.resolved?.syncedAt)) {
      item.dep.resolved = makeResolved(item.r.sha);
      pinned += 1;
    }
  }
  if (toFix.length > 0) {
    console.log(`Syncing ${toFix.length} skill(s)…`);
    for (const item of toFix) {
      try {
        if (item.status === 'missing') await reinstallFromDep(item.dep, { quiet: true, remote });
        else await syncToLocal(item.r, item.dep, { quiet: true, remote });
        synced += 1;
      } catch (error) {
        failures += 1;
        console.error(`  !  ${localNameOf(item.dep)}: ${error.message}`);
      }
    }
  }
  if (synced > 0 || pinned > 0) {
    await writeJson(DEPS_FILE, deps);
    if (pinned > 0) console.log(`  ok  pinned ${pinned} resolved commit(s) in dependencies.json`);
  }

  const ok = failures === 0;
  if (toFix.length === 0 && failures === 0) {
    console.log(`Sync ok: ${fresh.length} already up to date${pinned ? `, pinned ${pinned}` : ''}`);
  } else {
    console.log(
      ok
        ? `Sync ok: ${synced} updated, ${fresh.length} unchanged`
        : `Sync finished with errors: ${synced} updated, ${failures} failed, ${fresh.length} unchanged`,
    );
  }

  try {
    const result = await updateReadmeSkillsTable({ quiet: true });
    if (result.missingMarkers) {
      console.error('  !  README.md missing skills:table markers');
      return {
        ok: false,
        fresh: fresh.length,
        synced,
        missing: missing.length,
        errors: failures + 1,
        details,
      };
    }
    if (result.changed) console.log(`  ok  README skills table updated (${result.count})`);
  } catch (error) {
    console.error(`  !  README table refresh failed: ${error.message}`);
    return {
      ok: false,
      fresh: fresh.length,
      synced,
      missing: missing.length,
      errors: failures + 1,
      details,
    };
  }

  return {
    ok,
    fresh: fresh.length,
    synced,
    missing: missing.length,
    errors: failures,
    details,
  };
}
