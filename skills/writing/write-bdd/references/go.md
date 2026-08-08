# Go — Godog

## Recommended Framework

**Godog** (`github.com/cucumber/godog` v0.15+) — official Cucumber implementation for Go. Actively maintained by the Cucumber organization.

```bash
go get github.com/cucumber/godog@latest
```

## Project Structure

```
project/
├── features/
│   ├── account.feature
│   └── order.feature
├── godogs.go              # Production code
├── godogs_test.go         # Test entry point + step definitions
├── go.mod
└── go.sum
```

Step definitions must be in the **same Go package** as the code they test (or a `_test` variant). Godog respects Go's package-level isolation.

## Test Entry Point

```go
package godogs

import (
    "testing"
    "github.com/cucumber/godog"
)

func InitializeScenario(ctx *godog.ScenarioContext) {
    // Register steps here
    ctx.Step(`^there are (\d+) godogs$`, thereAreGodogs)
    ctx.Step(`^I eat (\d+)$`, iEat)
    ctx.Step(`^there should be (\d+) remaining$`, thereShouldBeRemaining)
}

func TestFeatures(t *testing.T) {
    suite := godog.TestSuite{
        ScenarioInitializer: InitializeScenario,
        Options: &godog.Options{
            Format:   "pretty",
            Paths:    []string{"features"},
            TestingT: t,  // Enables subtest mode
        },
    }
    if suite.Run() != 0 {
        t.Fatal("non-zero status returned, failed to run feature tests")
    }
}
```

When `TestingT: t` is set, each scenario runs as a Go subtest — enabling IDE debug-ability, `-run` regex filtering, and standard Go test output.

## State Management

### Official Pattern: context.Context

Every scenario gets a fresh context. Steps receive context and return an enriched context. **Use unexported key types to avoid collisions:**

```go
type godogsCtxKey struct{}

func thereAreGodogs(ctx context.Context, available int) (context.Context, error) {
    return context.WithValue(ctx, godogsCtxKey{}, available), nil
}

func iEat(ctx context.Context, num int) (context.Context, error) {
    available, ok := ctx.Value(godogsCtxKey{}).(int)
    if !ok {
        return ctx, errors.New("there are no godogs available")
    }
    return context.WithValue(ctx, godogsCtxKey{}, available-num), nil
}

func thereShouldBeRemaining(ctx context.Context, remaining int) error {
    available := ctx.Value(godogsCtxKey{}).(int)
    if available != remaining {
        return fmt.Errorf("expected %d godogs, but there are %d", remaining, available)
    }
    return nil
}
```

### Mutable Struct Pattern (many fields)

When many state fields are needed, store a struct pointer in context:

```go
type sharedStateKey struct{}

type SharedState struct {
    Name     string
    Response *http.Response
    DB       *sql.Tx
}

func getSharedState(ctx context.Context) (context.Context, *SharedState) {
    v := ctx.Value(sharedStateKey{})
    if v == nil {
        v = &SharedState{}
        ctx = context.WithValue(ctx, sharedStateKey{}, v)
    }
    return ctx, v.(*SharedState)
}

func someStep(ctx context.Context, name string) (context.Context, error) {
    ctx, state := getSharedState(ctx)
    state.Name = name  // Mutable access — pointer in context
    return ctx, nil
}
```

Always return the context on ALL code paths — even error paths: `return ctx, errors.New("...")` not `return nil, errors.New("...")`.

## Step Definition Signatures

Godog validates step function signatures via reflection. Supported argument types: `int` (`int8`..`int64`), `uint` (`uint8`..`uint64`), `float32`, `float64`, `string`, `[]byte`, `*godog.DocString`, `*godog.Table`.

If the first argument is `context.Context`, the runner passes the current context.

**Valid return combinations:**
1. Nothing — `func step()`
2. `error` — `func step() error`
3. `context.Context` — `func step(ctx context.Context) context.Context`
4. `(context.Context, error)` — `func step(ctx context.Context) (context.Context, error)`
5. `godog.Steps` — nested sub-steps: `func step() godog.Steps`

### Data Tables and Doc Strings

```go
// Data table
func validateTable(ctx context.Context, table *godog.Table) (context.Context, error) {
    for i, row := range table.Rows {
        if i == 0 { continue }  // Skip header
        currency := row.Cells[0].Value
        rate := row.Cells[1].Value
        // Validate...
    }
    return ctx, nil
}

// Doc string
func (a *AccountTestState) theRemittanceAddressMustBe(ctx context.Context, input *godog.DocString) error {
    if a.account.RemittanceAddress() != input.Content {
        return fmt.Errorf("expected %s but found %s", input.Content, a.account.RemittanceAddress())
    }
    return nil
}
```

## Hooks

### Suite-Level (TestSuiteContext)

```go
func InitializeTestSuite(sc *godog.TestSuiteContext) {
    sc.BeforeSuite(func() {
        // Start database, containers, servers — once for all scenarios
    })
    sc.AfterSuite(func() {
        // Shutdown — once after all scenarios
    })
}
```

### Scenario-Level (ScenarioContext)

```go
ctx.Before(func(ctx context.Context, sc *godog.Scenario) (context.Context, error) {
    // Reset state, create fresh transaction — runs before each scenario
    return context.Background(), nil  // Fresh context each scenario
})

ctx.After(func(ctx context.Context, sc *godog.Scenario, err error) (context.Context, error) {
    // Rollback transaction, cleanup — runs after each scenario (even on failure)
    return ctx, nil
})
```

### Step-Level (StepContext)

```go
stepCtx := ctx.StepContext()
stepCtx.Before(func(ctx context.Context, st *godog.Step) (context.Context, error) {
    return ctx, nil
})
stepCtx.After(func(ctx context.Context, st *godog.Step, status godog.StepResultStatus, err error) (context.Context, error) {
    if status == godog.StepFailed {
        ctx = godog.Attach(ctx, godog.Attachment{
            Body: screenshotBytes, FileName: st.Text + ".png", MediaType: "image/png",
        })
    }
    return ctx, nil
})
```

All hooks return `(context.Context, error)` — errors are accumulated. Contexts are threaded to the next hook.

## Configuration

### Options Struct

```go
type Options struct {
    ShowStepDefinitions bool     // Print step definitions and exit
    Randomize           int64    // 0=off, -1=auto seed, other=fixed seed
    StopOnFailure       bool     // Stop on first failure
    Strict              bool     // Fail on pending/undefined/ambiguous steps
    NoColors            bool     // Force ANSI color stripping
    Tags                string   // "@smoke and not @slow"
    Dialect             string   // Gherkin dialect, default "en"
    Format              string   // "pretty", "cucumber", "junit", "progress", "events"
    Concurrency         int      // Number of concurrent scenario runners (default 1)
    Paths               []string // Feature file paths
    Output              io.Writer
    DefaultContext      context.Context
    TestingT            *testing.T
    FS                  fs.FS    // Custom filesystem (embed.FS for embedded features)
}
```

Multiple formatters: `Format: "pretty,cucumber:report.json,junit:junit.xml"`

### Embedded Features (go:embed)

```go
//go:embed features/*
var features embed.FS

var opts = godog.Options{
    FS:    features,  // Self-contained test binary
    Paths: []string{"features"},
}
```

### Tag Filtering

```go
Options: &godog.Options{
    Tags: "@smoke and not @slow",
    Concurrency: 4,
}
```

## Nested Steps

```go
func userRegisters(name, email string) godog.Steps {
    return godog.Steps{
        fmt.Sprintf(`user "%s" creates an account`, name),
        fmt.Sprintf(`user receives a verification email at "%s"`, email),
        fmt.Sprintf(`user verifies their email`),
    }
}
```

**Limitation**: Nested steps cannot accept DocString or DataTable arguments.

## testify Integration

```go
func thereShouldBeRemaining(ctx context.Context, remaining int) error {
    assert.Equal(godog.T(ctx), godogs, remaining,
        "Expected %d godogs to be remaining, but there is %d", remaining, godogs)
    return nil
}
```

`godog.T(ctx)` returns a `TestingT` compatible with testify's `assert` and `require` packages.

## HTTP API Testing Pattern

```go
type apiFeature struct {
    resp *httptest.ResponseRecorder
}

func InitializeScenario(s *godog.ScenarioContext) {
    api := &apiFeature{}
    s.Before(func(ctx context.Context, sc *godog.Scenario) (context.Context, error) {
        api.resp = httptest.NewRecorder()  // Reset every scenario
        return ctx, nil
    })
    s.Step(`^I send "([^"]*)" request to "([^"]*)"$`, api.iSendrequestTo)
    s.Step(`^the response code should be (\d+)$`, api.theResponseCodeShouldBe)
}
```

## Common Gotchas

1. **ALWAYS return context on error paths**: `return ctx, err` — never `return nil, err` (loses state).
2. **Unexported key types** for context values — prevents key collisions between packages: `type userCtxKey struct{}`.
3. **Concurrency > 1 with global variables** causes data races. All state must flow through context.
4. **Optional regex groups with DocString/Table don't work** — create two separate step definitions that share a helper.
5. **Step definitions with the same regex** — in strict mode, ambiguous steps are detected; in non-strict, first match wins silently.
6. **`ErrPending`/`ErrUndefined`** pass by default. Use `Strict: true` to fail on them.

## Godog vs Other Go Testing

- **Use Godog** for: multi-step lifecycle transitions, CLI E2E workflows, user-facing acceptance tests.
- **Use table-driven tests** for: logic with many input/output pairs (matrix problems), pure functions.
- **Godog vs Ginkgo**: Godog uses Gherkin (.feature files) for business collaboration; Ginkgo uses Go DSL for developers only.
