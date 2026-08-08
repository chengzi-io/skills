# Python — Behave & pytest-bdd

## Recommended Frameworks

- **Behave** — Standalone BDD framework. Best for clean BDD workflow and Cucumber-like experience.
- **pytest-bdd** — pytest plugin. Best when your project already uses pytest and you want unified test runner.

## Behave

### Project Structure (convention-over-configuration)

```
project_root/
├── features/
│   ├── environment.py          # Hooks (before_all, after_all, etc.)
│   ├── account.feature
│   ├── order.feature
│   └── steps/
│       ├── account_steps.py    # Auto-discovered (any .py file in steps/)
│       └── order_steps.py
```

- Feature files MUST live in `features/` directory (or subdirectories).
- Step files MUST be in `features/steps/`. All `.py` files auto-loaded.
- `features/environment.py` is the single hooks file (NOT auto-discovered from subdirectories).

### The `context` Object — Layer-Based Scoping

Behave's context uses a **stack of layers** that auto-clean attributes:

| Layer | Pushed When | Popped When | Purpose |
|-------|-------------|-------------|---------|
| `testrun` | Start of run | End of run | Global setup (DB connections, browser) |
| `feature` | Before each `.feature` file | After each `.feature` file | Feature-wide fixtures |
| `rule` | Before each `Rule` | After each `Rule` | Rule-scoped data |
| `scenario` | Before each scenario | After each scenario | Scenario-isolated data |

When a layer is pushed, it **inherits** all attributes from lower layers. When popped, only attributes set IN that layer are removed. **No manual cleanup of scenario state needed.**

**Built-in context attributes**: `context.feature`, `context.scenario`, `context.tags`, `context.table`, `context.text`, `context.config`, `context.failed`, `context.aborted`, `context.active_outline`.

**Key methods**:
- `context.add_cleanup(func, *args, **kwargs)` — register cleanup (LIFO order after after_* hooks).
- `context.attach(mime_type, data)` — embed data in reports.

### Step Definitions

```python
from behave import given, when, then, step, register_type, use_step_matcher
import parse

# Default: parse matcher (format-string style)
@given('I have {count:d} cucumbers')
def step_impl(context, count):
    # count is already an int
    context.cucumber_count = count

# Custom type
@parse.with_pattern(r'\d+')
def parse_number(text):
    return int(text)
register_type(Number=parse_number)

@given('{amount:Number} vehicles')
def step_impl(context, amount):
    assert isinstance(amount, int)

# Regex matcher
use_step_matcher("re")
@when(r'I have (?P<count>\d+) cucumbers')
def step_impl(context, count):
    context.cucumber_count = int(count)  # Manual conversion

# CFParse matcher (cardinality)
use_step_matcher("cfparse")
@given('{amounts:Number+} as numbers')
def step_impl(context, amounts):  # amounts is a list
    pass

# Data tables
@given('I have the following products:')
def step_impl(context):
    for row in context.table:
        name = row['Name']
        price = row['Price']

# Doc strings
@given('I have the following description:')
def step_impl(context):
    description = context.text  # Multi-line string

# Step composition
@given('a setup sequence')
def step_impl(context):
    context.execute_steps('''
        Given I have 5 cucumbers
        When I eat 2 cucumbers
    ''')
```

### Hooks (environment.py)

```python
def before_all(context):
    # Once before everything — DB connection pool, browser launch
    context.db = connect_db()

def after_all(context):
    # Once after everything — close connections, quit browser
    context.db.close()

def before_feature(context, feature):
    # Before each .feature file — feature-level fixtures

def after_feature(context, feature):
    # After each .feature file

def before_scenario(context, scenario):
    # Before each scenario — reset state, create page object
    context.page = context.browser.new_page()
    context.add_cleanup(context.page.close)

def after_scenario(context, scenario):
    # After each scenario — cleanup runs even on failure

def before_step(context, step):
    # Before each step — step-level logging

def after_step(context, step):
    # After each step — screenshots on failure

def before_tag(context, tag):
    # For each tag on feature/scenario

def after_tag(context, tag):
    # After each tag processing
```

**If a feature/scenario is skipped** due to tag filtering, its hooks are NOT called.

### Tag-Based Fixture Activation

```python
# environment.py
from behave.fixture import use_fixture_by_tag

fixture_registry = {
    "fixture.browser.firefox": browser_firefox,
    "fixture.browser.chrome":  browser_chrome,
    "fixture.webserver":       webserver,
}

def before_tag(context, tag):
    if tag.startswith("fixture."):
        return use_fixture_by_tag(tag, context, fixture_registry)
```

In feature file: `@fixture.browser.chrome` activates the Chrome fixture.

### Configuration

**Config files** (first found wins): `.behaverc` → `behave.ini` → `setup.cfg` → `tox.ini` → `pyproject.toml` → `~/.behaverc`

```ini
# behave.ini
[behave]
format = pretty
tags = @smoke and not @slow
logging_level = INFO
stdout_capture = no
show_timings = yes
dry_run = no
jobs = 4
```

**pyproject.toml**:
```toml
[tool.behave]
format = "pretty"
logging_level = "INFO"
```

**Userdata (dynamic params)**:
```bash
behave -D plan_name="Custom Plan" -D base_url="http://staging.example.com"
```
Access: `context.config.userdata["plan_name"]`, `.getint("timeout")`, `.getbool("headless")`.

### Playwright + Behave Pattern

```python
from playwright.sync_api import sync_playwright

def before_all(context):
    context.playwright = sync_playwright().start()
    context.browser = context.playwright.chromium.launch(headless=True)

def before_scenario(context, scenario):
    context.page = context.browser.new_page()
    context.add_cleanup(context.page.close)

def after_all(context):
    context.browser.close()
    context.playwright.stop()
```

### Parallel Execution

```bash
behave --jobs 4  # Multiprocessing — each worker has its own Python process
```

### Reporting

- `--format pretty` — human-readable
- `--format json` — JSON output
- `--format plain` — plain text
- Third-party: `allure-behave`, `behave-html-formatter`, `behave-html-pretty-formatter`

## pytest-bdd

### Project Structure
```
project_root/
├── features/
│   ├── login.feature
│   └── publish.feature
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # Shared step definitions + fixtures
│   ├── test_login.py
│   └── test_publish.py
```

### Fixture-Based State Sharing

Instead of a mutable `context` object, pytest-bdd uses **pytest fixtures for dependency injection**:

```python
from pytest_bdd import scenario, given, when, then, parsers

@scenario('features/login.feature', 'Successful login')
def test_login():
    pass  # The scenario decorator generates the test

@given("I'm an author user", target_fixture="user")
def author_user():
    return {"name": "Alice", "role": "author"}

@given("I have an article", target_fixture="article")
def have_article(user):  # user fixture is injected here
    return {"title": "My Article", "author": user["name"], "published": False}

@when("I press the publish button")
def press_publish(article):
    article["published"] = True

@then("the article should be published")
def article_published(article):
    assert article["published"] is True
```

**Key**: `target_fixture` makes the step's return value a named pytest fixture. Subsequent steps receive it via dependency injection.

### Step Definition Syntax

```python
from pytest_bdd import given, when, then, step, parsers

# Default — string match
@given("I'm an author user")
def _(): pass

# Parse matcher
@given(parsers.parse("I have {count:d} cucumbers"))
def _(count): pass  # count is already int

# Converters
@given(parsers.parse("I have {count} items"), converters={"count": int})
def _(count): pass

# CFParse
@given(parsers.cfparse("there are {start:Number} cucumbers", extra_types={"Number": int}))
def _(start): pass

# Regex
@given(parsers.re(r"(?P<thing>.*)"))
def _(thing): pass

# Generic step (matches any keyword)
@step("I do something generic")
def _(): pass
```

### Yield Steps (Setup/Teardown)

```python
@when("I set up a temporary resource", target_fixture="resource")
def _():
    resource = open_resource()
    yield resource       # Value becomes the fixture
    resource.close()     # Auto-called during teardown
```

### pytest-bdd Hooks

```python
# In conftest.py
def pytest_bdd_before_scenario(request, feature, scenario):
    pass

def pytest_bdd_after_scenario(request, feature, scenario):
    pass

def pytest_bdd_step_error(request, feature, scenario, step, step_func, exception):
    pass  # Screenshots on failure, etc.

def pytest_bdd_apply_tag(tag, function):
    if tag == "skip":
        return pytest.mark.skip(reason="Tagged as skip")
```

### Configuration

```ini
# pytest.ini
[pytest]
bdd_features_base_dir = features/
```

### When to Choose Which

| Factor | Behave | pytest-bdd |
|--------|--------|------------|
| State sharing | `context` object (mutable, layer-scoped) | pytest fixtures (immutable patterns) |
| Parallel | `--jobs 4` (multiprocessing) | `-n auto` (pytest-xdist) |
| Reports | Limited built-in | Full pytest ecosystem |
| Learning curve for pytest users | Higher | Lower |
| Best for | Standalone BDD, Cucumber-like workflow | Existing pytest projects, mixed unit+BDD |

## Common Gotchas

1. **Never use global/module-level variables** for scenario state — they survive across scenarios.
2. **Always use `context.add_cleanup()`** for resources needing explicit teardown.
3. **Behave's `context` is NOT thread-safe** — parallel execution uses separate processes.
4. **pytest-bdd's `parsers.parse` uses `{name:type}`**, not Cucumber Expression syntax — different from Cucumber.js/JVM.
5. **Behave's step discovery is automatic** — just put `.py` files in `features/steps/`. No imports needed.
6. **Behave version 2 syntax** supports `not`, `and`, `or` in tag expressions.
