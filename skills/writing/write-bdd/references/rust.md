# Rust — cucumber-rs

## Recommended Framework

**cucumber** crate (v0.23+) — official Cucumber implementation for Rust. Uses procedural macros and async runtime.

```toml
[dev-dependencies]
cucumber = "0.23"
futures = "0.3"
tokio = { version = "1.40", features = ["macros", "rt-multi-thread", "sync", "time"] }

[[test]]
name = "example"        # Must match the test target filename
harness = false          # Cucumber controls output, not libtest
```

**Feature flags**: `macros` (default, required), `output-json` (implies `timestamps`), `output-junit`, `libtest` (IntelliJ), `tracing`, `timestamps`.

## Project Structure

```
tests/
├── features/
│   └── book/
│       ├── animal.feature
│       ├── login.feature
│       └── checkout.feature
├── cucumber.rs              # Main test target: World definition + main()
└── steps/
    ├── mod.rs                 # pub mod animal_steps; pub mod login_steps; ...
    ├── animal_steps.rs        # #[given], #[when], #[then] for animal domain
    ├── login_steps.rs         # Steps for login domain
    └── checkout_steps.rs
```

Step functions can be in any module — the attribute macros register them globally at compile time via `inventory::submit!`.

## World Struct

The World holds all test state. **Fresh World per scenario.** Must derive `Debug` + `Default` + `World`.

```rust
use cucumber::{given, when, then, World};

#[derive(Debug, Default, World)]
pub struct AnimalWorld {
    cat: Cat,
    animals: HashMap<String, Animal>,
}

// Custom constructor:
#[derive(Debug, World)]
#[world(init = Self::new)]
pub struct ApiWorld {
    client: reqwest::Client,
    base_url: String,
    response: Option<reqwest::Response>,
}

impl ApiWorld {
    async fn new() -> Result<Self, std::convert::Infallible> {
        Ok(Self {
            client: reqwest::Client::new(),
            base_url: "http://localhost:8080".into(),
            response: None,
        })
    }
}
```

## Step Definitions

### Matching Modes

```rust
// Literal match
#[given("a hungry cat")]
fn hungry_cat(world: &mut AnimalWorld) {
    world.cat.hungry = true;
}

// Regex match — always use ^...$ anchors
#[given(regex = r"^a (hungry|satiated) cat$")]
fn hungry_cat_regex(world: &mut AnimalWorld, state: String) {
    match state.as_str() {
        "hungry" => world.cat.hungry = true,
        "satiated" => world.cat.hungry = false,
        _ => unreachable!(),
    }
}

// Cucumber Expression
#[given(expr = "{word} is hungry")]
async fn someone_is_hungry(w: &mut World, user: String) {
    w.user = Some(user);
}

// Async step
#[when("I feed the cat")]
async fn feed_cat(world: &mut AnimalWorld) {
    tokio::time::sleep(Duration::from_secs(2)).await;
    world.cat.feed();
}

// Error handling
#[then("the cat is not hungry")]
fn cat_is_fed(world: &mut AnimalWorld) -> Result<(), &'static str> {
    (!world.cat.hungry)
        .then_some(())
        .ok_or("Cat is still hungry!")
}
```

### Strict Step Type Separation

cucumber-rs enforces `given`/`when`/`then` separation. A `#[then("...")]` will NOT match a `When` keyword. For legacy scenarios that reuse steps across types, stack attributes:

```rust
#[given("a hungry cat")]
#[when("a hungry cat")]
fn hungry_cat(world: &mut AnimalWorld) { ... }
```

### Custom Parameter Types

```rust
use cucumber::Parameter;

#[derive(Debug, Default, Parameter)]
#[param(name = "hungriness", regex = "hungry|satiated")]
enum State {
    Hungry,
    #[default]
    Satiated,
}

#[given(expr = "a {hungriness} cat")]
fn hungry_cat(world: &mut AnimalWorld, state: State) {
    world.cat.hungry = matches!(state, State::Hungry);
}
```

### Data Tables and Doc Strings

```rust
// Data Table — access via step.table
#[given(regex = r"^a (hungry|satiated) animal$")]
async fn hungry_animal(world: &mut AnimalWorld, step: &Step, state: String) {
    if let Some(table) = step.table.as_ref() {
        for row in table.rows.iter().skip(1) {  // Skip header
            let animal = &row[0];
            world.animals.entry(animal.clone())
                .or_insert(Animal::default())
                .hungry = matches!(state.as_str(), "hungry");
        }
    }
}

// Doc String — access via step.docstring
#[given(regex = r"^a (hungry|satiated) cat$")]
async fn hungry_cat_doc(world: &mut AnimalWorld, step: &Step, state: String) {
    if let Some(text) = step.docstring.as_ref() {
        if !text.contains("Felix") && !text.contains("Leo") {
            panic!("Only Felix and Leo can be fed");
        }
    }
}
```

**Access step metadata**: Name the argument `step` or mark with `#[step]`:
```rust
fn test_step(w: &mut MyWorld, step: &Step, matches: &[String]) { ... }
// or:
fn test_step(w: &mut MyWorld, #[step] s: &Step, matches: &[String]) { ... }
```

## Hooks

```rust
use futures::future;
use std::time::Duration;

#[tokio::main]
async fn main() {
    AnimalWorld::cucumber()
        .before(|_feature, _rule, _scenario, _world| {
            // Runs before the first step of each scenario (including Background)
            future::ready(()).boxed_local()
        })
        .after(|_feature, _rule, _scenario, ev, _world| {
            // Runs after the last step, even on failure/skip
            // ev: event::ScenarioFinished — indicates why scenario ended
            match ev {
                event::ScenarioFinished::StepPassed => { /* passed */ }
                event::ScenarioFinished::StepFailed(_, _, _) => { /* failed */ }
                event::ScenarioFinished::StepSkipped => { /* skipped */ }
                event::ScenarioFinished::BeforeHookFailed(_) => { /* hook failure */ }
            }
            future::ready(()).boxed_local()
        })
        .run_and_exit("tests/features/book").await;
}
```

**Important**: `after` receives `Option<&mut W>` — it's `None` if the World was never created (Before hook failed).

**Best practice**: Prefer `Background` over `Before` hooks. Whatever happens in a `Before` is invisible in .feature files. Reserve `Before` for technical setup (starting browsers, clearing caches).

## CLI and Configuration

### Builder Pattern

```rust
AnimalWorld::cucumber()
    .max_concurrent_scenarios(4)
    .fail_on_skipped()
    .with_writer(
        writer::Basic::raw(io::stdout(), writer::Coloring::Never, 0)
            .summarized()
            .assert_normalized(),
    )
    .run_and_exit("tests/features/book").await;
```

### CLI Options

```bash
cargo test --test example -- --help        # Show all options
cargo test --test example -- --tags=@smoke # Tag filtering
cargo test --test example -- -vv           # Verbose: show World state on failure
cargo test --test example -- --fail-fast   # Stop on first failure
cargo test --test example -- --concurrency=1  # Serial execution
```

**CLI options override any programmatic configuration.**

### The `@serial` Tag

```gherkin
@serial
Scenario: If we feed a satiated cat it will not become hungry
  Given a satiated cat
  When I feed the cat
  Then the cat is not hungry
```

Scenarios tagged `@serial` run in isolation — no concurrent execution with other scenarios. For entire suite serially, use `--concurrency=1`.

### `@allow.skipped` Tag

Used with `.fail_on_skipped()` to exempt specific scenarios:
```gherkin
@allow.skipped
Scenario: Work in progress
  Given something not yet implemented
```

### Multi-Crate Workspace

Add to `.cargo/config.toml`:
```toml
[env]
CARGO_WORKSPACE_DIR = { value = "", relative = true }
```

## HTTP API Testing Pattern

```rust
#[derive(Debug, World)]
#[world(init = Self::new)]
pub struct ApiWorld {
    client: reqwest::Client,
    base_url: String,
    response: Option<reqwest::Response>,
}

impl ApiWorld {
    async fn new() -> Result<Self, std::convert::Infallible> {
        Ok(Self {
            client: reqwest::Client::new(),
            base_url: "http://localhost:8080".into(),
            response: None,
        })
    }
}

#[when("I GET {string}")]
async fn get_endpoint(w: &mut ApiWorld, path: String) {
    w.response = Some(
        w.client.get(format!("{}/{}", w.base_url, path))
            .send().await.unwrap()
    );
}

#[then("the status is {int}")]
async fn check_status(w: &mut ApiWorld, status: u16) {
    assert_eq!(w.response.as_ref().unwrap().status().as_u16(), status);
}
```

## Output Formats

```rust
// JSON (feature: output-json)
World::cucumber()
    .with_writer(writer::Json::new(io::stdout()))
    .run_and_exit("tests/features").await;

// JUnit (feature: output-junit) — available via writer::junit::JUnit
// Libtest (feature: libtest) — for IntelliJ integration
World::cucumber()
    .with_writer(writer::Libtest::or_basic())
    .run("tests/features/book").await;

// Multiple writers via writer::Tee — combines outputs (console + file simultaneously)
```

## Step Modules Visibility

- World struct must be `pub` or visible to step function modules.
- Step functions do NOT need to be `pub` — macros handle discovery.
- Each domain gets its own `.rs` file in `tests/steps/`. Use `mod.rs` to declare submodules.

## Common Gotchas

1. **Always use `^...$` anchors** in regex patterns to prevent accidental cross-step matches.
2. **Empty/overlapping regex patterns** cause steps to be skipped (shown as `?`).
3. **`#[given]` ≠ `#[when]` ≠ `#[then]`** — strict separation enforced. Stack attributes if needed.
4. **`harness = false`** required in `[[test]]` — otherwise libtest takes over output.
5. **`futures` dep required** — needed for non-tokio executors (even if you use tokio, the macro needs it).
6. **IntelliJ integration** requires `--concurrency=1` for accurate breakpoints.
7. **Concurrent by default** — scenarios run in parallel (up to 64). Each gets its own World — ensure no shared mutable state.
8. **Failed steps don't stop the suite** by default. Use `--fail-fast` for that behavior.
9. **`after` hook World is `Option<&mut W>`** — World creation may have failed. Handle `None`.
10. **Custom init with `#[world(init = ...)]`** accepts sync/async and fallible/infallible functions.
