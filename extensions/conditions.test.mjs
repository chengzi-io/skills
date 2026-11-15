import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { detectConditions, pluginOf, selectSkills } from "./conditions.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "pi-conditions-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    if (path.endsWith("/")) {
      mkdirSync(full, { recursive: true });
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content ?? "");
  }
  return root;
}

describe("detectConditions", () => {
  it("detects a FastAPI backend split from a React frontend", () => {
    const root = fixture({
      "backend/requirements.txt": "fastapi\n",
      "backend/app/main.py": "",
      "frontend/package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "frontend/src/App.tsx": "",
    });

    assert.deepEqual(detectConditions(root).conditions, ["node", "python", "ui"]);
  });

  it("detects a workspace monorepo with nested package.json files", () => {
    const root = fixture({
      "package.json": JSON.stringify({ workspaces: ["apps/*", "packages/*"] }),
      "apps/web/package.json": JSON.stringify({ devDependencies: { react: "^18", vite: "^5" } }),
      "apps/web/src/main.tsx": "",
      "packages/shared/package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "services/api/pyproject.toml": "",
    });

    assert.deepEqual(detectConditions(root).conditions, ["node", "python", "ui"]);
  });

  it("detects a Go workspace through go.work without any go.mod", () => {
    const root = fixture({ "go.work": "go 1.22\n", "services/auth/main.go": "" });

    assert.deepEqual(detectConditions(root).conditions, ["go"]);
  });

  it("finds markers below the old depth-4 cutoff", () => {
    const root = fixture({ "a/b/c/d/e/pyproject.toml": "" });

    assert.deepEqual(detectConditions(root).conditions, ["python"]);
  });

  it("keeps an iOS project out of macos while still reporting swift", () => {
    const root = fixture({
      "android/build.gradle": "",
      "ios/Runner.xcodeproj/project.pbxproj": "SDKROOT = iphoneos;\n",
      "ios/Runner/AppDelegate.swift": "",
    });

    assert.deepEqual(detectConditions(root).conditions, ["java", "swift"]);
  });

  it("detects a macOS Xcode target from the pbxproj SDKROOT", () => {
    const root = fixture({
      "MyApp.xcodeproj/project.pbxproj": "SDKROOT = macosx;\n",
      "MyApp/App.swift": "",
    });

    assert.deepEqual(detectConditions(root).conditions, ["macos", "swift"]);
  });

  it("detects a macOS SwiftPM app from its platforms list", () => {
    const root = fixture({ "Package.swift": "platforms: [\n  .macOS(.v14),\n],\n" });

    assert.deepEqual(detectConditions(root).conditions, ["macos", "swift"]);
  });

  it("does not treat language samples in a docs repository as project conditions", () => {
    const root = fixture({
      "package.json": JSON.stringify({ devDependencies: { yaml: "^2" } }),
      "examples/sample.go": "",
      "examples/sample.py": "",
      "examples/sample.tsx": "",
      "examples/sample.swift": "",
    });

    assert.deepEqual(detectConditions(root).conditions, ["node"]);
  });

  it("ignores markers below skipped directories", () => {
    const root = fixture({ "node_modules/left-pad/package.json": "{}", "web/package.json": "{}" });

    assert.deepEqual(detectConditions(root).conditions, ["node"]);
    assert.equal(detectConditions(root).evidence.node, "web/package.json");
  });

  it("is deterministic across runs", () => {
    const root = fixture({
      "go.mod": "",
      "web/package.json": JSON.stringify({ dependencies: { react: "^18" } }),
    });

    assert.deepEqual(detectConditions(root), detectConditions(root));
  });
});

describe("selectSkills", () => {
  const skill = (plugin, name) => ({
    name,
    filePath: `/pkg/plugins/${plugin}/skills/${name}/SKILL.md`,
    description: name,
  });

  const skills = [
    skill("golang", "go-idioms"),
    skill("web", "better-ui"),
    skill("foundations", "tdd"),
    { name: "external", filePath: "/home/me/.agents/skills/external/SKILL.md", description: "external" },
  ];

  it("keeps foundations and out-of-package skills regardless of conditions", () => {
    const kept = selectSkills(skills, []).map((s) => s.name);

    assert.deepEqual(kept, ["tdd", "external"]);
  });

  it("keeps every satisfied plugin", () => {
    const kept = selectSkills(skills, ["go", "ui"]).map((s) => s.name);

    assert.deepEqual(kept, ["go-idioms", "better-ui", "tdd", "external"]);
  });

  it("treats a plugin without a condition as always relevant", () => {
    const kept = selectSkills([skill("pixel-art", "sprite")], []).map((s) => s.name);

    assert.deepEqual(kept, ["sprite"]);
  });

  it("is idempotent", () => {
    const once = selectSkills(skills, ["go"]);
    const twice = selectSkills(once, ["go"]);

    assert.deepEqual(twice, once);
  });

  it("maps a skill path to its plugin, tolerating Windows separators", () => {
    assert.equal(pluginOf("C:\\repo\\plugins\\golang\\skills\\x\\SKILL.md"), "golang");
    assert.equal(pluginOf("/home/me/.agents/skills/x/SKILL.md"), undefined);
  });
});
