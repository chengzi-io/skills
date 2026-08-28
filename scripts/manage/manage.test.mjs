import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  depLocalDir,
  flattenDeps,
  globToRegExp,
  isIgnoredFile,
  localNameOf,
  moveInMarketplace,
  parseFrontmatter,
  parseRepo,
  renameInMarketplace,
  renderSkillsTable,
  compareWithUpstream,
  reinstallFromDep,
  syncToLocal,
  withFrontmatterName,
} from '../manage.mjs';

const temporaryDirectories = new Set();

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'chengzi-manage-test-'));
  temporaryDirectories.add(directory);
  return directory;
}

test.afterEach(async () => {
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories.clear();
});

test('parses repositories, frontmatter, and supported ignore globs', () => {
  assert.deepEqual(parseRepo('https://github.com/acme/tools.git/'), { owner: 'acme', repo: 'tools' });
  assert.deepEqual(parseRepo('acme/tools'), { owner: 'acme', repo: 'tools' });
  assert.equal(parseRepo('not a repo'), null);
  assert.deepEqual(parseFrontmatter('---\nname: demo\ndescription: Test\n---\nbody'), {
    name: 'demo',
    description: 'Test',
  });
  assert.equal(parseFrontmatter('no frontmatter'), null);
  assert.equal(withFrontmatterName('---\nname: old\ndescription: x\n---\nbody', 'new'), '---\nname: new\ndescription: x\n---\nbody');
  assert.equal(globToRegExp('assets/**').test('assets/image.png'), true);
  assert.equal(isIgnoredFile('assets/image.png', ['assets/**']), true);
  assert.equal(isIgnoredFile('nested/image.png', ['**/*.png']), true);
  assert.equal(isIgnoredFile('image.txt', ['**/*.png']), false);
  assert.equal(isIgnoredFile('foo/bar.txt', ['foo/**/bar.txt']), true);
  assert.equal(isIgnoredFile('foo/deep/bar.txt', ['foo/**/bar.txt']), true);
});

test('computes local paths and keeps flattened dependency fields delegated', () => {
  const deps = {
    version: 2,
    sources: [{
      repo: 'acme/tools',
      branch: 'main',
      resolved: { sha: 'old', syncedAt: 'before' },
      items: [{
        type: 'skill',
        path: 'skills/demo',
        ignore: ['assets/**'],
        target: { plugin: 'web', name: 'demo-local' },
      }],
    }],
  };
  const [dep] = flattenDeps(deps);
  assert.equal(localNameOf(dep), 'demo-local');
  assert.match(depLocalDir(dep), /plugins\/web\/skills\/demo-local$/);
  dep.target.name = 'renamed';
  dep.resolved = { sha: 'new', syncedAt: 'after' };
  dep.ignore = ['docs/**'];
  assert.equal(deps.sources[0].items[0].target.name, 'renamed');
  assert.deepEqual(deps.sources[0].resolved, { sha: 'new', syncedAt: 'after' });
  assert.deepEqual(deps.sources[0].items[0].ignore, ['docs/**']);
});

test('renames and moves marketplace skill paths and escapes README cells', () => {
  const marketplace = {
    plugins: [
      { name: 'old', skills: ['./skills/demo', './skills/other'] },
      { name: 'new', skills: [] },
    ],
  };
  renameInMarketplace(marketplace, './skills/demo', './skills/renamed');
  assert.deepEqual(marketplace.plugins[0].skills, ['./skills/renamed', './skills/other']);
  moveInMarketplace(marketplace, './skills/renamed', 'new');
  assert.deepEqual(marketplace.plugins[0].skills, ['./skills/other']);
  assert.deepEqual(marketplace.plugins[1].skills, ['./skills/renamed']);
  const table = renderSkillsTable([{
    name: 'demo',
    plugin: 'web|ui',
    description: 'line one\nline | two',
    path: 'plugins/web/skills/demo',
    repo: 'acme/tools',
    local: 'yes',
  }]);
  assert.match(table, /web\\\|ui/);
  assert.match(table, /line one line \\| two/);
  assert.match(table, /\[acme\/tools\]\(https:\/\/github.com\/acme\/tools\)/);
});

function fakeRemote(tree, contents, { failPath } = {}) {
  return {
    async getTree() {
      return tree.map((pathName) => ({ type: 'blob', path: pathName }));
    },
    async fetchRaw(_owner, _repo, _ref, filePath) {
      if (filePath === failPath) throw new Error(`network failure: ${filePath}`);
      if (!(filePath in contents)) throw new Error(`missing fixture: ${filePath}`);
      return contents[filePath];
    },
    async resolveCommitSha() {
      return '0123456789012345678901234567890123456789';
    },
  };
}

test('reinstall fully replaces the destination and drops ignored local files', async () => {
  const root = await temporaryDirectory();
  const destination = path.join(root, 'demo');
  await mkdir(path.join(destination, 'assets'), { recursive: true });
  await writeFile(path.join(destination, 'SKILL.md'), 'old skill');
  await writeFile(path.join(destination, 'stale.txt'), 'stale');
  await writeFile(path.join(destination, 'README.md'), 'local ignored');
  await writeFile(path.join(destination, 'assets', 'local.txt'), 'local ignored dir file');

  const tree = [
    'skills/demo/SKILL.md',
    'skills/demo/README.md',
    'skills/demo/assets/remote.txt',
    'skills/demo/new.txt',
  ];
  const remote = fakeRemote(tree, {
    'skills/demo/SKILL.md': 'new skill',
    'skills/demo/README.md': 'upstream ignored',
    'skills/demo/assets/remote.txt': 'remote asset',
    'skills/demo/new.txt': 'new file',
  });
  const dep = {
    type: 'skill',
    source: { repo: 'acme/tools', branch: 'main', path: 'skills/demo' },
    target: { plugin: 'web', name: 'demo' },
    ignore: ['README.md', 'assets/**'],
  };

  const result = await reinstallFromDep(dep, { destination, remote, quiet: true });
  assert.deepEqual(result, {
    localName: 'demo',
    sha: '0123456789012345678901234567890123456789',
  });
  assert.equal(await readFile(path.join(destination, 'SKILL.md'), 'utf8'), 'new skill');
  assert.equal(await readFile(path.join(destination, 'new.txt'), 'utf8'), 'new file');
  await assert.rejects(readFile(path.join(destination, 'stale.txt')));
  await assert.rejects(readFile(path.join(destination, 'README.md')));
  await assert.rejects(readFile(path.join(destination, 'assets', 'local.txt')));
  await assert.rejects(readFile(path.join(destination, 'assets', 'remote.txt')));
  assert.equal(dep.resolved.sha, '0123456789012345678901234567890123456789');
  assert.deepEqual((await readdir(root)).filter((entry) => entry.startsWith('.tmp-')), []);
});

test('reinstall failure cleans the temporary directory and preserves the old destination', async () => {
  const root = await temporaryDirectory();
  const destination = path.join(root, 'demo');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'old.txt'), 'keep me');
  const remote = fakeRemote(
    ['skills/demo/SKILL.md', 'skills/demo/new.txt'],
    { 'skills/demo/SKILL.md': 'new', 'skills/demo/new.txt': 'new' },
    { failPath: 'skills/demo/new.txt' },
  );
  const dep = {
    source: { repo: 'acme/tools', branch: 'main', path: 'skills/demo' },
    target: { plugin: 'web', name: 'demo' },
  };
  await assert.rejects(
    reinstallFromDep(dep, { destination, remote, quiet: true }),
    /network failure/,
  );
  assert.equal(await readFile(path.join(destination, 'old.txt'), 'utf8'), 'keep me');
  assert.deepEqual((await readdir(root)).filter((entry) => entry.startsWith('.tmp-')), []);
  assert.equal(dep.resolved, undefined);
});

test('incremental comparison ignores configured files while retaining local-only files', async () => {
  const root = await temporaryDirectory();
  const destination = path.join(root, 'demo');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'SKILL.md'), 'same');
  await writeFile(path.join(destination, 'local.txt'), 'local only');
  await writeFile(path.join(destination, 'assets.txt'), 'ignored local');
  const remote = fakeRemote(
    ['skills/demo/SKILL.md', 'skills/demo/new.txt', 'skills/demo/assets.txt'],
    {
      'skills/demo/SKILL.md': 'same',
      'skills/demo/new.txt': 'remote new',
      'skills/demo/assets.txt': 'ignored upstream',
    },
  );
  const dep = {
    source: { repo: 'acme/tools', branch: 'main', path: 'skills/demo' },
    target: { plugin: 'web', name: 'demo' },
    ignore: ['assets.txt'],
  };
  const result = await compareWithUpstream(dep, { destination, remote });
  assert.deepEqual(result.remoteOnly, ['new.txt']);
  assert.deepEqual(result.localOnly, ['local.txt']);
  assert.equal(result.changed, 0);
  await syncToLocal(result, dep, { destination, remote, quiet: true });
  assert.equal(await readFile(path.join(destination, 'new.txt'), 'utf8'), 'remote new');
  assert.equal(await readFile(path.join(destination, 'local.txt'), 'utf8'), 'local only');
  assert.equal(await readFile(path.join(destination, 'assets.txt'), 'utf8'), 'ignored local');
});
