import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  githubOwnerRepo,
  pluginScopeAndWhen,
  renderPluginsTable,
  renderSkillsTable,
  replaceMarkedBlock,
  sourceRepoLink,
  updateReadmeTables,
} from '../manage.mjs';

const temporaryDirectories = new Set();

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'chengzi-readme-test-'));
  temporaryDirectories.add(directory);
  return directory;
}

test.afterEach(async () => {
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories.clear();
});

test('pluginScopeAndWhen reads scope and when from marketplace descriptions', () => {
  assert.deepEqual(pluginScopeAndWhen({
    name: 'foundations',
    description: 'Language-agnostic skills. Install at user scope for every project.',
  }), { scope: 'user', when: 'Every project' });
  assert.deepEqual(pluginScopeAndWhen({
    name: 'macos',
    description: 'Native macOS app skills. Install at project scope in macOS app repositories.',
  }), { scope: 'project', when: 'macOS app repositories' });
  assert.deepEqual(pluginScopeAndWhen({
    name: 'web',
    description: 'Web, React, and UI skills. Install at project scope in frontend repositories.',
  }), { scope: 'project', when: 'Frontend repositories' });
  assert.deepEqual(pluginScopeAndWhen({ name: 'python' }), {
    scope: 'project',
    when: 'Python repositories',
  });
});

test('githubOwnerRepo and sourceRepoLink format original author repos', () => {
  assert.equal(githubOwnerRepo('emilkowalski/skills'), 'emilkowalski/skills');
  assert.equal(githubOwnerRepo('https://github.com/chengzi-io/skills'), 'chengzi-io/skills');
  assert.equal(githubOwnerRepo('https://github.com/chengzi-io/skills.git'), 'chengzi-io/skills');
  assert.equal(githubOwnerRepo(''), '');
  assert.equal(sourceRepoLink('fayazara/macos-app-skills'), '[fayazara/macos-app-skills](https://github.com/fayazara/macos-app-skills)');
  assert.equal(sourceRepoLink(''), '-');
});

test('renderSkillsTable includes a Source column for the original repo', () => {
  const table = renderSkillsTable([
    {
      name: 'macos-patterns',
      plugin: 'macos',
      description: 'Native macOS patterns.',
      path: 'plugins/macos/skills/macos-patterns',
      repo: 'fayazara/macos-app-skills',
      local: 'yes',
    },
    {
      name: 'write-adr',
      plugin: 'foundations',
      description: 'Draft ADRs.',
      path: 'plugins/foundations/skills/write-adr',
      repo: '',
      local: 'yes',
    },
  ]);
  assert.match(table, /\| Skill \| Plugin \| Source \| Description \|/);
  assert.match(table, /\[fayazara\/macos-app-skills\]\(https:\/\/github.com\/fayazara\/macos-app-skills\)/);
  assert.match(table, /write-adr.+ \| - \|/);
});

test('renderPluginsTable only placeholders plugins with zero skills', () => {
  const table = renderPluginsTable([
    { name: 'macos', scope: 'project', when: 'Native macOS app repositories', skillCount: 5 },
    { name: 'python', scope: 'project', when: 'Python repositories', skillCount: 0 },
  ]);
  assert.match(table, /\*\*macos\*\* \| project \| Native macOS app repositories \|/);
  assert.doesNotMatch(table, /\*\*macos\*\*.*placeholder/);
  assert.match(table, /\*\*python\*\* \| project \| Python repositories \(placeholder, no skills yet\) \|/);
});

test('replaceMarkedBlock swaps only the marked region', () => {
  const source = 'before\n<!-- x:start -->\nold\n<!-- x:end -->\nafter';
  const result = replaceMarkedBlock(source, '<!-- x:start -->', '<!-- x:end -->', 'new');
  assert.equal(result.missing, false);
  assert.equal(result.changed, true);
  assert.equal(result.next, 'before\n<!-- x:start -->\n\nnew\n\n<!-- x:end -->\nafter');
  assert.equal(replaceMarkedBlock('no markers', '<!-- x:start -->', '<!-- x:end -->', 'new').missing, true);
});

test('updateReadmeTables refreshes plugins and skills blocks from disk', async () => {
  const root = await temporaryDirectory();
  const pluginsRoot = path.join(root, 'plugins');
  const macos = path.join(pluginsRoot, 'macos', 'skills', 'macos-patterns');
  await mkdir(macos, { recursive: true });
  await mkdir(path.join(pluginsRoot, 'python', 'skills'), { recursive: true });
  await writeFile(path.join(macos, 'SKILL.md'), '---\nname: macos-patterns\ndescription: Native macOS patterns.\n---\n');
  const mktFile = path.join(root, 'marketplace.json');
  await writeFile(mktFile, `${JSON.stringify({
    owner: { url: 'https://github.com/chengzi-io/skills' },
    plugins: [
      { name: 'macos', description: 'Native macOS app skills. Install at project scope in macOS app repositories.' },
      { name: 'python', description: 'Python engineering skills. Install at project scope in Python repositories.' },
    ],
  }, null, 2)}\n`);
  const depsFile = path.join(root, 'dependencies.json');
  await writeFile(depsFile, `${JSON.stringify({
    version: 2,
    sources: [{
      repo: 'fayazara/macos-app-skills',
      branch: 'main',
      items: [{ type: 'skill', path: 'macos-patterns', target: { plugin: 'macos', name: 'macos-patterns' } }],
    }],
  }, null, 2)}\n`);
  const readmeFile = path.join(root, 'README.md');
  await writeFile(readmeFile, [
    '<!-- plugins:table:start -->',
    '',
    '| Plugin | Scope | When |',
    '|--------|--------|------|',
    '| **macos** | project | Native macOS app repositories (placeholder, no skills yet) |',
    '',
    '<!-- plugins:table:end -->',
    '',
    '<!-- skills:table:start -->',
    '',
    '| Skill | Plugin | Source | Description |',
    '|-------|--------|--------|-------------|',
    '| _(none)_ | | |',
    '',
    '<!-- skills:table:end -->',
    '',
  ].join('\n'));

  const result = await updateReadmeTables({
    quiet: true,
    readmeFile,
    root,
    depsFile,
    mktFile,
    pluginsRoot,
    skillsRoot: path.join(root, 'skills'),
  });
  assert.equal(result.changed, true);
  assert.equal(result.pluginCount, 2);
  assert.equal(result.count, 1);

  const readme = await readFile(readmeFile, 'utf8');
  assert.match(readme, /\*\*macos\*\* \| project \| macOS app repositories \|/);
  assert.doesNotMatch(readme, /\*\*macos\*\*.*placeholder/);
  assert.match(readme, /Python repositories \(placeholder, no skills yet\)/);
  assert.match(readme, /\[`macos-patterns`\]\(plugins\/macos\/skills\/macos-patterns\)/);
  assert.match(readme, /\[fayazara\/macos-app-skills\]\(https:\/\/github.com\/fayazara\/macos-app-skills\)/);
});
