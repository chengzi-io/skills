import { discoverSkills } from './skills.mjs';
import { getDefaultBranch, parseRepo, setCacheEnabled } from './github.mjs';
import { updateReadmeSkillsTable } from './readme.mjs';
import { syncAll } from './sync.mjs';
import { validateAll } from './validate.mjs';
import { main } from './commands.mjs';

export const HELP = `chengzi-skills manager

Usage:
  npm run manage                 Interactive menu
  npm run sync                   Sync all third-party skills from upstream
  npm run sync:check             Check only (exit 1 if outdated/missing)
  npm run readme                 Regenerate skills table in README.md
  npm run readme -- --check      Fail if README table is stale
  node scripts/manage.mjs validate
  node scripts/manage.mjs --list-repo <owner/repo>
  node scripts/manage.mjs sync --no-cache   bypass GitHub response cache

Env:
  GITHUB_TOKEN        Optional; higher GitHub API rate limit
  MANAGE_CACHE_TTL_MS GitHub response cache TTL in ms (default 600000)
`;

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.includes('--no-cache')) setCacheEnabled(false);
  const [command, ...rest] = argv;

  if (command === '--list-repo' && rest[0]) {
    const parsed = parseRepo(rest[0]);
    if (!parsed) {
      console.error('Use owner/repo');
      process.exit(1);
    }
    const branch = await getDefaultBranch(parsed.owner, parsed.repo);
    const skills = await discoverSkills(parsed.owner, parsed.repo, branch);
    console.log(JSON.stringify({ repo: `${parsed.owner}/${parsed.repo}`, branch, skills }, null, 2));
    return;
  }

  if (command === 'sync') {
    const result = await syncAll({ checkOnly: rest.includes('--check') });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'validate') {
    const ok = await validateAll();
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (command === 'readme') {
    const checkOnly = rest.includes('--check');
    try {
      const result = await updateReadmeSkillsTable({ checkOnly, quiet: checkOnly });
      if (result.missingMarkers) {
        console.error('README.md missing <!-- skills:table:start --> / <!-- skills:table:end --> markers');
        process.exitCode = 1;
        return;
      }
      if (checkOnly) {
        if (result.changed) {
          console.error(`README skills table is stale (${result.count} skill(s)) — run: pnpm readme`);
          process.exitCode = 1;
        } else {
          console.log(`README skills table ok (${result.count} skill(s))`);
        }
        return;
      }
      console.log(
        result.changed
          ? `README skills table updated (${result.count} skill(s))`
          : `README skills table already up to date (${result.count} skill(s))`,
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
    return;
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return;
  }
  if (command) {
    console.error(`Unknown command: ${command}`);
    console.error('Run with --help for usage');
    process.exitCode = 1;
    return;
  }
  await main();
}
