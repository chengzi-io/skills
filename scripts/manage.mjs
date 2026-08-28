#!/usr/bin/env node
/**
 * chengzi-skills manager entry point.
 *
 * Implementation lives in scripts/manage/*.mjs; this file intentionally
 * keeps the historical module exports and CLI bootstrap stable.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from './manage/cli.mjs';

export {
  ROOT,
  DEPS_FILE,
  MKT_FILE,
  README_FILE,
  SKILLS_ROOT,
  PLUGINS_ROOT,
  depLocalDir,
  destFor,
  localNameOf,
  relPosix,
  safeName,
  readJson,
  writeJson,
  makeResolved,
  shortSha,
} from './manage/workspace.mjs';

export {
  GH_API,
  CONCURRENCY,
  cachedCall,
  fetchRaw,
  getDefaultBranch,
  getTree,
  ghFetch,
  ghHeaders,
  mapPool,
  parseRepo,
  resolveCommitSha,
  setCacheEnabled,
} from './manage/github.mjs';

export {
  SKIP_DIRS,
  discoverSkills,
  displayGroup,
  downloadSkill,
  findLocalSkills,
  globToRegExp,
  isIgnoredFile,
  isSkillFile,
  parseFrontmatter,
  skillRootOf,
  skipped,
  walkLocal,
  withFrontmatterName,
} from './manage/skills.mjs';

export {
  ensurePlugin,
  flattenDeps,
  formatSourceLabel,
  knownRepos,
  loadGroups,
  moveInMarketplace,
  pluginOfRelPath,
  removeDependencyDirs,
  removeFromMarketplace,
  renameInMarketplace,
  renameSkillTo,
  skillToPlugin,
  sourceSig,
  upsertDependency,
} from './manage/catalog.mjs';

export {
  buildChecklist,
  compareWithUpstream,
  reinstallFromDep,
  syncAll,
  syncToLocal,
} from './manage/sync.mjs';

export {
  collectPluginRows,
  collectSkillRows,
  formatSkillList,
  githubOwnerRepo,
  mdCell,
  oneLine,
  pluginScopeAndWhen,
  sourceRepoLink,
  printSection,
  refreshReadme,
  renderPluginsTable,
  renderSkillsTable,
  replaceMarkedBlock,
  truncate,
  updateReadmeSkillsTable,
  updateReadmeTables,
} from './manage/readme.mjs';

export { validateAll } from './manage/validate.mjs';
export {
  checkUpstream,
  collectSkill,
  listCollected,
  main,
  manageCollected,
  selectGroup,
  withSpinner,
} from './manage/commands.mjs';
export { HELP, runCli } from './manage/cli.mjs';

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
}
