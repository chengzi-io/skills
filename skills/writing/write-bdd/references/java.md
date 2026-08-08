# Java — Cucumber-JVM

## Recommended Framework

**Cucumber-JVM** (v7.34+) — official and most mature Cucumber implementation. Maven Central.

```xml
<dependency>
    <groupId>io.cucumber</groupId>
    <artifactId>cucumber-java</artifactId>
    <version>7.34.4</version>
    <scope>test</scope>
</dependency>
```

**Critical rule**: ALL Cucumber dependencies must use the exact same version.

## Project Structure

```
src/test/
├── java/
│   └── com/example/
│       ├── glue/                    # Step definitions (by DOMAIN)
│       │   ├── UserSteps.java
│       │   ├── PaymentSteps.java
│       │   └── Hooks.java
│       ├── context/                 # Shared state objects
│       │   └── TestContext.java
│       └── runner/                  # Test runners
│           └── RunCucumberTest.java
└── resources/
    ├── features/                    # Feature files
    │   ├── user/
    │   │   ├── registration.feature
    │   │   └── login.feature
    │   └── payment/
    │       └── checkout.feature
    └── cucumber.properties          # Configuration
```

## Runners

### JUnit 5 Platform Engine (RECOMMENDED)

Dependency: `cucumber-junit-platform-engine`

```java
import org.junit.platform.suite.api.*;
import static io.cucumber.junit.platform.engine.Constants.*;

@Suite
@IncludeEngines("cucumber")
@SelectPackages("com.example")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.example.glue")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "pretty, json:target/cucumber.json")
public class RunCucumberTest {
}
```

### JUnit 4 (DEPRECATED — use only for legacy)

```java
@RunWith(Cucumber.class)
@CucumberOptions(
    features = "classpath:features",
    glue = "com.example.glue",
    plugin = {"pretty", "json:target/cucumber.json"},
    tags = "@smoke and not @slow"
)
public class RunCucumberTest {
}
```

### TestNG

```java
@CucumberOptions(plugin = "json:target/cucumber.json")
public class RunCucumberTest extends AbstractTestNGCucumberTests {
    @DataProvider(parallel = true)
    @Override
    public Object[][] scenarios() {
        return super.scenarios();
    }
}
```

## Step Definitions

```java
import io.cucumber.java.en.*;

// Cucumber Expression (recommended)
@Given("I have {int} cucumbers in my belly")
public void i_have_n_cukecumbers(int cukes) {
    this.cukes = cukes;
}

// Regular Expression
@Given("^I have (\\d+) cucumbers in my belly$")
public void i_have_n_cukecumbers_regex(int cukes) {
    this.cukes = cukes;
}

// Data Table
@Given("the following users exist:")
public void users_exist(DataTable dataTable) {
    List<Map<String, String>> users = dataTable.asMaps();
    // Access: users.get(0).get("name")
}

// Custom parameter type
@ParameterType("red|blue|green|yellow")
public Color color(String color) {
    return new Color(color);
}

// Then use: @Given("I have a {color} ball")

// Complex custom type
@ParameterType("([0-9]{4})-([0-9]{2})-([0-9]{2})")
public LocalDate iso8601Date(String year, String month, String day) {
    return LocalDate.of(Integer.parseInt(year), Integer.parseInt(month), Integer.parseInt(day));
}

// DataTable type
@DataTableType
public Author authorEntry(Map<String, String> entry) {
    return new Author(entry.get("firstName"), entry.get("lastName"), entry.get("famousBook"));
}
```

## Dependency Injection

### PicoContainer (Recommended Default)

Artifact: `cucumber-picocontainer`. **Zero configuration** — just add the dependency. PicoContainer uses constructor injection automatically. All step definitions and their dependencies recreated for each scenario.

```java
// Shared state — all steps receive the same instance per scenario
public class TestContext {
    private String currentUser;
    private Response response;
    // getters/setters
}

// Step definitions — constructor injection
public class LoginSteps {
    private final TestContext context;
    public LoginSteps(TestContext context) { this.context = context; }

    @When("I login as {string}")
    public void login(String user) { context.setCurrentUser(user); }
}

public class ProfileSteps {
    private final TestContext context;
    public ProfileSteps(TestContext context) { this.context = context; }

    @Then("I should see my profile")
    public void checkProfile() { /* uses context.getCurrentUser() */ }
}
```

For cleanup: implement `org.picocontainer.Disposable` on the state class. Disposable runs AFTER Cucumber `@After` hooks.

### Spring Boot

Artifact: `cucumber-spring`

```java
@CucumberContextConfiguration
@SpringBootTest(classes = TestConfig.class)
public class CucumberSpringConfiguration { }

// In step definitions:
public class MySteps {
    @Autowired
    private MyService service;  // Access Spring beans
}
```

For scenario-scoped state:
```java
@Component
@ScenarioScope
public class ScenarioState {
    // Fresh instance per scenario
}
```

**Rules**: Only ONE class on the glue path should have `@CucumberContextConfiguration`. Do NOT combine `@DirtiesContext` with parallel execution (undefined behavior).

### Guice

Artifact: `cucumber-guice`

```java
@ScenarioScoped  // One instance per scenario
public class MySteps {
    @Inject
    public MySteps(SomeDep dep) { ... }
}
```

## Hooks

```java
import io.cucumber.java.*;

public class Hooks {

    @Before
    public void setUp() { }

    @Before(order = 10)  // Lower runs first
    public void highPrioritySetup() { }

    @Before("@browser and not @headless")  // Conditional
    public void forBrowserOnly(Scenario scenario) { }

    @After
    public void tearDown(Scenario scenario) {
        if (scenario.isFailed()) {
            byte[] screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(screenshot, "image/png", "failure");
        }
    }

    @BeforeAll  // Must be STATIC
    public static void beforeAll() {
        // Start embedded services, run migrations
    }

    @AfterAll  // Must be STATIC
    public static void afterAll() {
        // Shutdown services
    }

    @BeforeStep
    public void beforeStep() { }

    @AfterStep
    public void afterStep() { }
}
```

**Ordering**: `@Before` runs in declaration order; `@After` runs in REVERSE. Multiple hooks without explicit `order` have undefined execution order — use `order` parameter when ordering matters.

## Configuration

### Configuration Precedence (highest to lowest)

1. CLI arguments
2. `@CucumberOptions` annotation / `@ConfigurationParameter`
3. System properties (`-Dcucumber.filter.tags="@smoke"`)
4. Environment variables (`CUCUMBER_FILTER_TAGS=@smoke`)
5. `cucumber.properties` file on classpath

### cucumber.properties

```properties
cucumber.plugin=pretty, json:target/cucumber.json, html:target/cucumber.html, junit:target/junit.xml
cucumber.filter.tags=@smoke and not @slow
cucumber.execution.dry-run=false
cucumber.execution.order=random
cucumber.snippet-type=camelcase
```

### Tag Expressions

```bash
--tags "@smoke and not @slow"
--tags "@gui or @database"
--tags "(@smoke or @ui) and (not @slow)"
```

Operators: `not`, `and`, `or`. Parentheses for grouping. Precedence: `not` > `and` > `or`.

## REST API Testing (RestAssured)

```java
@When("I create a user with name {string}")
public void createUser(String name) {
    Response response = RestAssured.given()
        .contentType(ContentType.JSON)
        .body(new User(name))
        .post("/api/users");
    testContext.setResponse(response);
}

@Then("the response status should be {int}")
public void checkStatus(int expectedStatus) {
    assertEquals(expectedStatus, testContext.getResponse().getStatusCode());
}
```

API tests are recommended over UI tests — APIs change less frequently, are faster, and tests survive longer.

## Reporters

| Plugin | Purpose |
|--------|---------|
| `pretty` | Human-readable console |
| `progress` | Dot-based progress |
| `html:path/report.html` | Static HTML |
| `json:path/report.json` | Cucumber JSON |
| `junit:path/junit.xml` | JUnit XML (CI) |
| `rerun:path/rerun.txt` | Failed scenario paths for re-run |
| `timeline:path/timeline/` | Visual timeline of parallel execution |

Third-party: **Allure**, **ExtentReports**, **Masterthought** (enhanced HTML), **Cluecumber** (Maven plugin).

## Parallel Execution

JUnit 4: Features are parallelized, but scenarios within a feature share a thread.
TestNG: Individual scenarios run in separate threads (finer granularity).
CLI: `--threads 4` runs scenarios in multiple threads.

Always ensure scenario-scoped state to avoid concurrency bugs. Never use static variables for test state.

## Common Gotchas

1. **Version mismatch** — all `io.cucumber:*` dependencies must be exactly the same version.
2. **Static state leaks** — everything must be scenario-scoped. Use DI for fresh instances.
3. **JUnit 4 `@RunWith` is deprecated** — migrate to JUnit 5 Platform Engine for new projects.
4. **`@BeforeAll`/`@AfterAll` must be static** — non-static methods cause errors.
5. **Expression detection**: `^...$` forces regex, otherwise Cucumber Expression. Cannot mix syntaxes.
6. **Clean databases in `@Before`, not `@After`** — a failing scenario's `@After` may leave stale data.
7. **Prefer `Background` over `@Before`** for setup visible to non-technical readers.
8. **`@DirtiesContext` + parallel execution = undefined behavior** — avoid this combination.
