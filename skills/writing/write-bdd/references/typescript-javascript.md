# TypeScript / JavaScript — Cucumber.js

## Recommended Framework

**@cucumber/cucumber** (v12.9+) — official Cucumber implementation for Node.js. Primary language is TypeScript (77.5% of the codebase).

```bash
npm install --save-dev @cucumber/cucumber
```

## Project Structure

```
project/
├── features/
│   ├── account/
│   │   ├── account.feature
│   │   └── step_definitions/
│   │       └── account.steps.ts
│   ├── order/
│   │   ├── order.feature
│   │   └── step_definitions/
│   │       └── order.steps.ts
│   └── support/
│       ├── world.ts              # Custom World class
│       ├── hooks.ts              # Before/After hooks
│       └── parameter_types.ts    # Custom parameter types
├── cucumber.js                   # Config (or cucumber.json, cucumber.yaml)
├── package.json
└── tsconfig.json
```

## TypeScript Setup

**Recommended: `tsx`** (official recommendation — fast, zero-config):
```bash
npm install --save-dev tsx
```

**cucumber.json** (CommonJS):
```json
{
  "default": {
    "requireModule": ["tsx/cjs"],
    "require": ["features/step_definitions/**/*.ts", "features/support/**/*.ts"]
  }
}
```

**ESM setup** uses a register file with `tsx/esm/api`:
```js
// tsx-register.js
import { register } from 'tsx/esm/api'
register()
```

Then in config: `"import": ["./tsx-register.js", "features/step_definitions/**/*.ts"]`

**Alternative**: `ts-node` (slower, but honors tsconfig): `"requireModule": ["ts-node/register"]`

Run `tsc --noEmit` separately in CI — skip typechecking during test execution for speed.

## Configuration

cucumber-js auto-discovers config files (first found):
1. `cucumber.json`
2. `cucumber.yaml` / `cucumber.yml`
3. `cucumber.js` / `cucumber.cjs` / `cucumber.mjs`
4. Custom via `--config path/to/config.json`

**Key config with profiles**:
```javascript
// cucumber.js
const common = {
  requireModule: ['tsx/cjs'],
  require: ['features/support/**/*.ts', 'features/step_definitions/**/*.ts'],
}
module.exports = {
  default: { ...common, format: ['progress-bar', 'html:cucumber-report.html'] },
  ci:     { ...common, format: ['html:cucumber-report.html'], parallel: 3, publish: true },
  wip:    { ...common, tags: '@wip and not @slow' },
}
```

**All config options**: `paths`, `dryRun`, `failFast`, `format`, `formatOptions`, `import`/`require`, `requireModule`, `loader`, `language`, `name`, `tags`, `order` (defined/random/random:seed), `parallel`, `retry`, `retryTagFilter`, `worldParameters`, `publish`, `strict`.

## Custom World

World is an **isolated context per scenario** — fresh instance every scenario (including retries). Extend the built-in `World` class:

```typescript
// features/support/world.ts
import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber'
import { Browser, BrowserContext, Page } from 'playwright'

export class CustomWorld extends World {
  count = 0
  browser: Browser
  context: BrowserContext
  page: Page

  constructor(options: IWorldOptions) {
    super(options)
  }

  async init() { /* set up browser, page, etc. */ }
}

setWorldConstructor(CustomWorld)
```

Access World as `this` in steps/hooks. **Do NOT use arrow functions** — they don't bind `this`. Or use the `world` object (v10.8+):

```typescript
import { Given, world } from '@cucumber/cucumber'
Given('I have {int} cucumbers', (count: number) => {
  world.count = count  // world is typed; no `this` needed
})
```

**World parameters** from config: `this.parameters.appUrl`. Parameters are cloned per scenario (v10.1+) to prevent mutation leaking.

Built-in World provides: `this.attach(data, options?)`, `this.log(text)`, `this.link(url)`.

## Step Definitions

```typescript
import { Given, When, Then, DataTable } from '@cucumber/cucumber'

// Cucumber Expression (recommended)
Given('I have {int} cucumbers in my belly', function (count: number) {
  this.count = count
})

// Regex pattern
Given(/^I have (\d+) cucumbers in my belly$/, function (count: string) {
  this.count = parseInt(count)
})

// Async steps
When('I navigate to {string}', async function (url: string) {
  await this.page.goto(url)
})

// Data table
Given('the following users:', function (dataTable: DataTable) {
  const users = dataTable.hashes()  // Array<Record<string, string>>
  const rows  = dataTable.rows()    // 2-D array without header
  const raw   = dataTable.raw()     // 2-D array including header
})

// Doc string
Given('a multi-line description:', function (docString: string) {
  // docString is the raw text between triple quotes
})

// Custom timeout
Given('a slow operation', { timeout: 60000 }, async function () {
  await this.slowOperation()
})
```

**Pending and Skipped**:
```typescript
Given('unimplemented step', function () { return 'pending' })
Given('a skipped step', function () { return 'skipped' })
```

## Custom Parameter Types

```typescript
// features/support/parameter_types.ts
import { defineParameterType } from '@cucumber/cucumber'

defineParameterType({
  name: 'color',
  regexp: /red|blue|green|yellow/,
  transformer: (s: string) => s.toUpperCase(),  // Transform before passing to step
  useForSnippets: true,      // Include in generated snippets (default: true)
  preferForRegexpMatch: false // Prefer this type's regexp for regex matching
})

// Usage:
Given('I have a {color} ball', function (color: string) {
  // color is "RED", "BLUE", etc.
})
```

## Hooks

```typescript
import { Before, After, BeforeAll, AfterAll, BeforeStep, AfterStep, Status } from '@cucumber/cucumber'

// Before each scenario — setup
Before(function () { /* sync */ })
Before(async function () { /* async */ })

// After each scenario — cleanup. ALWAYS runs, even if scenario failed.
After(async function (scenario) {
  if (scenario.result?.status === Status.FAILED) {
    await this.attach(screenshot, 'image/png')
  }
})

// Tagged hooks
Before({ tags: '@browser and not @headless' }, function () { ... })
Before('@foo', function () { ... })  // shorthand

// Named hooks (appear in formatter output)
Before({ name: 'Set up test state' }, function () { ... })

// BeforeAll/AfterAll — once per worker (NO World `this` available)
BeforeAll(async function () {
  // Start database containers, run migrations
})

// BeforeStep/AfterStep
AfterStep(function ({ result }) {
  if (result.status === Status.FAILED) {
    this.attach(screenshot, 'image/png')
  }
})

// Skipping scenarios from hooks
Before(function () {
  if (someRuntimeCondition) return 'skipped'  // or Promise.resolve('skipped')
})
```

**Execution order**: `BeforeAll` → `Before` (definition order) → `BeforeStep` → step → `AfterStep` (reverse) → `After` (reverse) → `AfterAll` (reverse).

## Playwright + cucumber-js Pattern

```typescript
// hooks.ts
import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber'
import { chromium } from 'playwright'

let browser: Browser

BeforeAll(async () => {
  browser = await chromium.launch({ headless: true })
})

Before(async function (this: CustomWorld) {
  this.context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  this.page = await this.context.newPage()
})

After(async function (this: CustomWorld) {
  await this.context?.close()
})

AfterAll(async () => { await browser?.close() })
```

One browser per worker (BeforeAll), fresh context per scenario (Before). This balances speed and isolation.

## Reporting

| Formatter | Output | Purpose |
|-----------|--------|---------|
| `progress` | stdout | One char per step (default) |
| `progress-bar` | stdout | Progress bar with stats |
| `pretty` | stdout | Human-readable, indented |
| `summary` | stdout | Overall results summary |
| `html:report.html` | File | Standalone HTML report |
| `json:report.json` | File | JSON report |
| `message:report.ndjson` | File | Modern NDJSON format (preferred for tooling) |
| `junit:report.xml` | File | JUnit XML for CI |
| `rerun:@rerun.txt` | File | Failed scenario paths for re-running |

Multiple formatters: `"format": ["progress-bar", "html:cucumber-report.html", "junit:junit.xml", "rerun:@rerun.txt"]`

## Parallel Execution

```json
{ "parallel": 3 }
```

Env vars per worker: `CUCUMBER_PARALLEL=true`, `CUCUMBER_TOTAL_WORKERS`, `CUCUMBER_WORKER_ID`. `BeforeAll`/`AfterAll` run once per worker.

## Common Gotchas

1. **Arrow functions don't bind `this`** — use `function` declarations or the `world` object.
2. **`retry` + `retryTagFilter`** — only retry flaky scenarios tagged with e.g. `@flaky`. Not for routine use.
3. **Never mutate `this.parameters`** in steps — it's shared config. Clone if needed.
4. **ESM vs CJS** — pick one and be consistent. `requireModule` for CJS, `import` for ESM.
5. **Clean databases in `Before`, not `After`** — allows post-mortem inspection of failure state.
