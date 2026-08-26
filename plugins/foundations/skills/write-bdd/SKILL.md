---
name: write-bdd
description: Write, review, and implement BDD Gherkin .feature files and step definitions. Use when the user asks to write scenarios, review feature files, create BDD specs, implement step definitions, or mentions .feature, Gherkin, Cucumber, Given/When/Then, BDD scenarios, behave, godog, cucumber-rs, or cucumber-jvm.
license: MIT
metadata:
  version: "2026.06.29"
---

# Write BDD (Gherkin + Cucumber)

BDD is a collaborative practice with three activities: **Discovery** (what *could* it do), **Formulation** (what *should* it do), and **Automation** (what does it *actually* do). This skill covers Formulation and Automation — writing clear Gherkin scenarios and implementing maintainable step definitions.

## Core Principle

**Declarative, not imperative.** Feature files describe *what* the system should do from a business perspective — never *how* it does it (UI clicks, API calls, database queries). Good scenarios remain valid when the underlying technology changes.

**Litmus test:** "Will this wording need to change if the implementation does?" If yes, rewrite it. Ask: "Could someone in 1922 (before computers) understand this scenario?"

```gherkin
# BAD — Imperative (coupled to UI implementation)
Scenario: Free users see free articles
  When I type "free@example.com" in the email field
  And I type "validPassword123" in the password field
  And I press the "Submit" button
  Then I see "FreeArticle1" on the home page

# GOOD — Declarative (describes behaviour)
Scenario: Free subscribers see only free articles
  Given Free Frieda has a free subscription
  When Free Frieda logs in with her valid credentials
  Then she sees a Free article
```

## Project Structure

Feature files are organized by **domain concept** — the same domain used as `DOMAIN` in EARS requirement IDs (see `write-ears` skill). One domain directory holds one or more `.feature` files. Step definitions live in a shared `steps/` directory at domain level — **not** one per feature file.

```
features/
├── auth/
│   ├── login.feature
│   ├── registration.feature
│   └── steps/
│       └── auth.steps.ts
├── payment/
│   ├── checkout.feature
│   └── refund.feature
└── support/                 # Hooks, World, parameter types (shared)
```

See language-specific reference files in `references/` for framework-specific conventions, exact layouts, and configuration.

## Workflow

### 1. Discovery (before writing)

Identify the business rule and concrete examples. Use **Example Mapping** (yellow story card → blue rules → green examples → red questions). Involve the three amigos: product owner, developer, tester. If a workshop takes >30 minutes, the story is too large.

### 2. Formulation (writing the feature file)

Write the feature file using declarative language. Apply the quality rules below. Validate:
- Can a non-technical stakeholder read it aloud and understand it?
- Are all outcomes observable (no database/internal assertions)?
- Are scenarios independent?
- Does the language survive implementation changes?

### 3. Automation (implementing step definitions)

- Run `dry-run` to see which steps need definitions.
- Implement step definitions in domain-organized files (see `references/` for language conventions).
- Keep step definitions thin — delegate to helper code.
- Re-run until all steps pass.

### 4. Validation Checklist

- [ ] Dry-run passes (every step has a matching definition)
- [ ] Scenarios are declarative — no UI or implementation details
- [ ] 3–5 steps per scenario typical; no scenario exceeds 8
- [ ] One behaviour per scenario (one primary `When` + `Then`)
- [ ] `Then` steps verify observable outcomes only
- [ ] Step definitions organized by domain, not feature
- [ ] Step definitions are thin (parse → delegate → assert)
- [ ] No shared state across scenarios
- [ ] Tags used consistently and purposefully
- [ ] `@wip` tags on incomplete work
- [ ] `Background` ≤ 4 lines, vivid names used

## Writing Scenarios — Best Practices

### Step Count

Aim for **3–5 steps per scenario** (Cucumber official guidance). One `When` + one primary `Then` is ideal. Too many steps lose expressive power as specification.

### Scenario Titles

Describe the scenario in a single sentence. If you can't, it's doing too much — split it.

### Scenario Outline vs Separate Scenarios

Use **Scenario Outline** when the *same behavior* applies across different data combinations. Write **separate Scenario**s when the behavior itself differs (different logic, different flow).

```gherkin
Scenario Outline: Eating cucumbers
  Given I have <start> cucumbers
  When I eat <eat> cucumbers
  Then I should have <left> cucumbers

  Examples:
    | start | eat | left |
    |    12 |   5 |    7 |
    |    20 |   5 |   15 |
```

### When to Split a Feature File

- If the `Background` scrolls off screen → split now.
- A single `.feature` file approaching **25 scenarios** is a strong smell (official Cucumber anti-pattern). Review whether multiple business rules are sharing one file.
- Different business rules with different `Background` needs should live in separate files. Use Gherkin's `Rule` keyword for sub-rules *within* a file first; split when `Rule`s need fundamentally different setups.

### Background — When and How

Use `Background` when the *same* `Given` steps repeat in every scenario AND those steps are incidental details (not the story). **Keep it short — max 4 lines.** If the `Background` scrolls off screen, split the feature file or elevate steps to higher-level abstractions. Make it vivid — use colourful names ("Greg the admin"), not "User A".

Do NOT use `Background` for setup that is meaningless to the business. Use higher-level steps instead:
```gherkin
# BAD — too much detail
Background:
  Given I am on the login page
  And I type "admin@example.com" in the email field
  And I type "password123" in the password field
  And I click the "Sign In" button

# GOOD — one declarative step
Background:
  Given I am logged in as an administrator
```

If different scenarios need different setups, split into multiple `Feature`s or `Rule`s — don't force everything through one `Background`.

### Scenario Independence

**Every scenario must be self-contained.** Never rely on execution order. Each scenario sets up its own preconditions. Global or static state between scenarios is forbidden — Cucumber creates fresh step definition instances and a fresh World per scenario by design.

### Observable Outcomes

`Then` steps must verify things an external observer can see — a response, a message, a report, a UI element. Never assert on database internals, private variables, or implementation details.

```gherkin
# BAD — internal state assertion
Then the user record in the database has confirmed_at set

# GOOD — observable outcome
Then I should receive a confirmation email
And the dashboard shows "Account confirmed"
```

### Vivid Names

Use specific, colourful persona names ("Bob with balance $500") rather than generic ones ("User A"). They make scenarios more readable and help stakeholders relate to the examples.

### Requirement Traceability

Tag every scenario with its corresponding EARS requirement ID. This makes the requirements → acceptance tests mapping explicit and enables filtering by requirement.

```gherkin
@FR-AUTH-0001
Scenario: Successful login with valid credentials
  Given ...

@FR-AUTH-0001 @FR-AUTH-0003
Scenario: Login fails after account lockout
  Given ...
```

One scenario can satisfy multiple requirements (stack tags). One requirement may need multiple scenarios (same tag appears across scenarios). This many-to-many mapping is normal.

## Gherkin Syntax Reference

### Keywords

| Keyword | Aliases | Purpose |
|---------|---------|---------|
| `Feature` | — | Top-level description. Exactly one per `.feature` file. Must appear first. |
| `Rule` | — | (Gherkin 6+) One business rule. Groups scenarios that illustrate it. Optional. Can contain its own `Background`. |
| `Scenario` | `Example` | A concrete example illustrating a business rule. |
| `Scenario Outline` | `Scenario Template` | Runs the same scenario with different data from an `Examples` table. |
| `Examples` | `Scenarios` | Data table beneath a `Scenario Outline` — each row (after the header) produces one execution. |
| `Background` | — | `Given` steps run before every scenario in the `Feature` (or `Rule`). |
| `Given` | — | Preconditions — configures the system to a known state. |
| `When` | — | An event or action. One primary `When` per scenario is ideal. |
| `Then` | — | Expected outcome. Must verify **observable outputs**, not internal state. |
| `And` | — | Chains successive steps of the same type for readability. |
| `But` | — | Same as `And`, used for negative assertions. |
| `*` | — | Replaces any step keyword. Use sparingly. |

### Formatting Rules

- **Comments**: `#` at line start. Block comments are not supported.
- **Indentation**: Two spaces recommended. Tabs also valid.
- **Keyword colon**: `Feature:`, `Scenario:`, `Scenario Outline:`, `Background:`, `Rule:` use colons. Step keywords (`Given`, `When`, `Then`, `And`, `But`, `*`) do NOT. Adding a colon after a step keyword silently drops the test.
- **Free-form descriptions**: Allowed under `Feature`, `Scenario`, `Background`, `Scenario Outline`, and `Rule`. Must not start with a keyword. Markdown is supported (HTML formatter renders it).
- **Localization**: Use `# language: fr` header for non-English Gherkin keywords.

### Doc Strings and Data Tables

**Doc Strings** — pass multi-line text to a step. Delimited by `"""`. Optional content type: `"""json`.

```gherkin
Given I have a note
  """
  This is a multi-line
  piece of text
  """
```

**Data Tables** — pass tabular data to a step:

```gherkin
Given the following users exist:
  | name  | email             |
  | Alice | alice@example.com |
  | Bob   | bob@example.com   |
```

Both work inside `Scenario Outline` with `<placeholder>` parameters.

### Tags

Tags control execution filtering and hook selection. Place them above `Feature`, `Rule`, `Scenario`, `Scenario Outline`, or `Examples` (not above `Background` or individual steps).

```gherkin
@smoke @api
Feature: User management

  @fast
  Scenario: Quick login
```

**Inheritance**: Tags on `Feature` propagate to all children. Tags on `Scenario Outline` propagate to its `Examples`.

**Tag expressions** for filtering use infix boolean operators: `@smoke and not @slow`, `(@gui or @api) and not @wip`.

**Common tag categories**: `@smoke`, `@regression`, `@wip` (work-in-progress), `@fast`/`@slow`, `@critical`/`@edge-case`.

**Naming**: lowercase with hyphens (`@smoke-test`). Escape reserved characters `(`, `)`, `\`, space with `\`.

## Cucumber Expressions

Cucumber Expressions are the recommended alternative to Regular Expressions — more readable and self-documenting.

| Expression | Matches | Type |
|-----------|---------|------|
| `{int}` | `71`, `-19` | Integer |
| `{float}` | `3.6`, `.8`, `-9.2` | Float |
| `{word}` | `banana` (no whitespace) | Single word |
| `{string}` | `"banana split"` or `'banana split'` | String (quotes stripped) |
| `{}` | anything | Anonymous (matches `/.*/`) |

**Optional text**: `I have {int} cucumber(s) in my belly` — matches both singular and plural.

**Alternative text**: `I have {int} cucumber(s) in my belly/stomach` — matches either.

**Custom parameter types** allow domain-specific types (Color, Date, Money, etc.) via language-specific `defineParameterType` or equivalent.

See language reference files in `references/` for syntax details and registration APIs.

**Expression vs Regex detection**: Patterns starting with `^` or `$` are treated as Regex. Otherwise, Cucumber Expression is assumed. You cannot mix the two syntaxes in one pattern.

## Step Definition Best Practices

### Organization

**Organize step definitions by domain concept, NOT by feature file.** This is the most important organizational rule.

```
# BAD — feature-coupled
features/steps/
  edit_work_experience_steps.ts
  edit_languages_steps.ts
  edit_education_steps.ts

# GOOD — domain-organized
features/steps/
  accounts/
    account_steps.ts
  checkout/
    checkout_steps.ts
  common/
    auth_steps.ts
```

**Why**: Step definitions match steps purely by expression text — the file name, class name, or package has no bearing on matching. Organize by domain so steps are discoverable and reusable across features.

### Step Definitions Must Be Thin

Step definitions are glue code — they parse parameters, delegate to domain/helper code, and assert results. **Never put business logic in step definitions.** Extract reusable helper methods for composition.

### Step Type Independence

Cucumber ignores the keyword (`Given`/`When`/`Then`) when matching step definitions. Two steps with identical text but different keywords are **duplicates**:

```gherkin
Given there is money in my account  # DUPLICATE
Then there is money in my account   # DUPLICATE
```

This forces precise domain language. Write instead:
```gherkin
Given my account has a balance of £430
Then my account should have a balance of £430
```

### Reuse

Write step definitions to be reused across features. A step like `Given I am logged in as an administrator` should work for any feature that needs an admin user.

### State Sharing — The World Pattern

Every scenario gets a **fresh, isolated instance** of state. The mechanism varies by language:

- **TypeScript/JS**: Custom `World` class extended from `@cucumber/cucumber`. Store state as instance properties on `this`. Use `setWorldConstructor()`.
- **Java**: PicoContainer (recommended default), Spring (`@ScenarioScoped`), or Guice (`@ScenarioScoped`). New instances per scenario.
- **Python (Behave)**: `context` object with layer-based scoping (testrun → feature → rule → scenario). Layers auto-clean attributes.
- **Go (Godog)**: `context.Context` with unexported key types. Return enriched context from steps.
- **Rust**: `World` derive macro. `&mut World` passed to each step function. Fresh `World` per scenario.

⚠️ **Never share mutable state between scenarios.** This breaks parallel execution and makes scenarios order-dependent.

## Hooks

| Hook | Purpose | World Access |
|------|---------|-------------|
| `Before` | Run before each scenario. Set up test fixtures, clean databases. | Yes |
| `After` | Run after each scenario (even if failed). Cleanup, screenshots on failure. | Yes |
| `BeforeAll` | Once before ALL scenarios. Heavy shared setup (DB migration, browser launch). | No |
| `AfterAll` | Once after ALL scenarios. Shared teardown. | No |
| `BeforeStep` | Before each step. Rarely needed. | Yes |
| `AfterStep` | After each step. Useful for screenshots on failure. | Yes |

**Execution order**: `BeforeAll` → `Before` → `BeforeStep` → step → `AfterStep` → `After` → `AfterAll`. Multiple `Before` hooks run in definition order; multiple `After` hooks run in **reverse** definition order.

**Tagged hooks** run conditionally: `Before({tags: "@browser and not @headless"}, function() { ... })`.

**Rule of thumb**: Prefer `Background` (visible in feature files) over `Before` hooks (invisible to readers). Reserve `Before` for purely technical setup: clearing databases, launching browsers, deleting cookies.

## Anti-Patterns

1. **Feature-coupled step definitions** — steps organized per feature file instead of by domain. Causes explosion of duplication.

2. **Conjunction steps** — combining multiple actions into one step. Split into atomic `And`/`But` steps instead. Cucumber has `And` and `But` keywords for a reason.

3. **Calling steps from step definitions** — not supported in Cucumber-JVM/JS (by design); possible but strongly discouraged in Cucumber-Ruby. Extract helper methods instead.

4. **Too many scenarios per feature file** — if the `Background` scrolls off screen, split.

5. **Imperative steps** — UI-focused steps like `When I click "#login-button"`. Couples features to implementation.

6. **Sharing state between scenarios** — global/static variables leaking cross-scenario state. Always use per-scenario isolation.

7. **Long Backgrounds** — 8+ setup steps. Move to higher-level `Given` steps or split feature files.

8. **No `@wip` discipline** — failing scenarios accumulate without a signal they are known work-in-progress. Tag incomplete work and exclude from CI.

9. **Arrow functions for hooks/steps in JS** — arrow functions don't bind `this` (the World). Use regular functions or the `world` object (v10.8+).

10. **Testing implementation details** — asserting database records, cache entries, or private variables instead of observable behaviour.

## Language-Specific Implementation

For concrete implementation details (project structure, step definition syntax, World patterns, hooks, configuration), refer to the corresponding file in `references/`:

| Language / Framework | Reference File | Key Detail |
|---------------------|---------------|------------|
| TypeScript / JavaScript | `references/typescript-javascript.md` | `@cucumber/cucumber`, tsx transpiler, custom World, Playwright patterns |
| Java | `references/java.md` | Cucumber-JVM, PicoContainer/Spring DI, JUnit 5, RestAssured |
| Python | `references/python.md` | Behave (context layers), pytest-bdd (fixtures), Playwright patterns |
| Go | `references/go.md` | Godog, context.Context state, `go test` integration |
| Rust | `references/rust.md` | cucumber-rs, `#[derive(World)]`, async/tokio, macros |

**When to load a reference**: Read the relevant file when the user specifies their tech stack, or when you need to implement step definitions in a specific language.

## Quick Reference

- Gherkin is localized — `# language: fr` enables French keywords
- Dry-run: `cucumber-js --dry-run` / `behave --dry-run` / `godog run --dry-run`
- Tag filtering CLI: `--tags "@smoke and not @slow"`
- BDD complements, does not replace, the testing pyramid — unit tests still matter
- Step definitions cannot be keyword-specific: `Given x` and `Then x` with identical text are duplicates
- Never skip the Discovery phase — writing scenarios without understanding business rules produces weak tests
