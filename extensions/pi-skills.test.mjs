import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, it } from "node:test";

import piSkills, { DECISION_ENTRY } from "./pi-skills.mjs";

function project(files) {
  const root = mkdtempSync(join(tmpdir(), "pi-skills-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content ?? "");
  }
  return root;
}

function skill(plugin, name) {
  return { name, description: name, filePath: `/pkg/plugins/${plugin}/skills/${name}/SKILL.md` };
}

const external = { name: "external", description: "external", filePath: "/home/me/.agents/skills/external/SKILL.md" };

function loadedSkills() {
  return [skill("golang", "go-idioms"), skill("rust", "rust-idioms"), skill("foundations", "tdd"), external];
}

function harness() {
  const handlers = new Map();
  const appended = [];
  const pi = {
    on: (event, handler) => handlers.set(event, handler),
    appendEntry: (customType, data) => appended.push({ type: "custom", customType, data }),
  };
  return { pi, handlers, appended };
}

function context(cwd, entries = [], hasUI = true) {
  const notifications = [];
  return {
    notifications,
    ctx: {
      cwd,
      hasUI,
      ui: { notify: (message) => notifications.push(message) },
      sessionManager: { getEntries: () => entries },
    },
  };
}

function start(handlers, reason, ctx) {
  return handlers.get("session_start")({ type: "session_start", reason }, ctx);
}

function run(handlers, ctx, skills = loadedSkills()) {
  const event = { type: "before_agent_start", systemPromptOptions: { skills: [...skills] } };
  handlers.get("before_agent_start")(event, ctx);
  return event.systemPromptOptions.skills.map((entry) => entry.name);
}

let extension;
beforeEach(() => {
  extension = harness();
  piSkills(extension.pi);
});

describe("session-scoped skill filtering", () => {
  it("keeps only plugins that match the project, plus skills outside this package", () => {
    const root = project({ "go.mod": "" });
    const { ctx } = context(root);

    start(extension.handlers, "new", ctx);
    assert.deepEqual(run(extension.handlers, ctx), ["go-idioms", "tdd", "external"]);
  });

  it("records the decision once and announces it once", () => {
    const root = project({ "go.mod": "" });
    const { ctx, notifications } = context(root);

    start(extension.handlers, "new", ctx);
    run(extension.handlers, ctx);
    run(extension.handlers, ctx);

    assert.equal(extension.appended.length, 1);
    assert.equal(extension.appended[0].customType, DECISION_ENTRY);
    assert.deepEqual(extension.appended[0].data, { cwd: root, conditions: ["go"], names: ["go-idioms", "tdd", "external"] });
    assert.deepEqual(notifications, ["skills: 3/4 kept (go)"]);
  });

  it("replays the recorded decision on resume instead of re-detecting", () => {
    const root = project({ "go.mod": "", "Cargo.toml": "" });
    const recorded = [{ type: "custom", customType: DECISION_ENTRY, data: { cwd: root, conditions: ["go"], names: ["go-idioms"] } }];
    const { ctx } = context(root, recorded);

    start(extension.handlers, "resume", ctx);

    assert.deepEqual(run(extension.handlers, ctx), ["go-idioms"]);
    assert.deepEqual(extension.appended, []);
  });

  it("re-detects when a resumed session runs from a different directory", () => {
    const root = project({ "Cargo.toml": "" });
    const recorded = [{ type: "custom", customType: DECISION_ENTRY, data: { cwd: "/somewhere/else", conditions: ["go"], names: ["go-idioms"] } }];
    const { ctx } = context(root, recorded);

    start(extension.handlers, "resume", ctx);

    assert.deepEqual(run(extension.handlers, ctx), ["rust-idioms", "tdd", "external"]);
    assert.equal(extension.appended.length, 1);
  });

  it("re-detects after reload so newly installed skills become visible", () => {
    const root = project({ "go.mod": "" });
    const recorded = [{ type: "custom", customType: DECISION_ENTRY, data: { cwd: root, conditions: [], names: ["tdd"] } }];
    const { ctx } = context(root, recorded);

    start(extension.handlers, "reload", ctx);

    assert.deepEqual(run(extension.handlers, ctx), ["go-idioms", "tdd", "external"]);
  });

  it("keeps foundations and external skills when no condition is detected", () => {
    const root = project({ "README.md": "" });
    const { ctx } = context(root);

    start(extension.handlers, "new", ctx);

    assert.deepEqual(run(extension.handlers, ctx), ["tdd", "external"]);
  });

  it("stays stable across runs with the same skill list", () => {
    const root = project({ "go.mod": "" });
    const { ctx } = context(root);

    start(extension.handlers, "new", ctx);
    const first = run(extension.handlers, ctx);
    const second = run(extension.handlers, ctx);

    assert.deepEqual(second, first);
  });

  it("survives a skill disappearing after the decision was recorded", () => {
    const root = project({ "go.mod": "" });
    const { ctx } = context(root);

    start(extension.handlers, "new", ctx);
    run(extension.handlers, ctx);

    assert.deepEqual(run(extension.handlers, ctx, [skill("foundations", "tdd")]), ["tdd"]);
  });

  it("does not notify when the session has no UI", () => {
    const root = project({ "go.mod": "" });
    const { ctx, notifications } = context(root, [], false);

    start(extension.handlers, "new", ctx);
    run(extension.handlers, ctx);

    assert.deepEqual(notifications, []);
  });
});
