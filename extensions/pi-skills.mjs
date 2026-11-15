import { detectConditions, selectSkills } from "./conditions.mjs";

export const DECISION_ENTRY = "pi-skills/decision";

/** Reasons that continue an existing transcript, where a stable prompt matters more than fresh detection. */
const REPLAY_REASONS = new Set(["resume", "fork"]);

/**
 * Hide skills whose plugin does not apply to the current project.
 *
 * The decision is made once per session and replayed unchanged on every run,
 * because the skill list lives in the system prompt: changing it mid-session
 * invalidates the provider's prompt cache for the whole conversation.
 */
export default function piSkills(pi) {
  let state;
  let announced = false;

  const readPrior = (ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.type === "custom" && entry.customType === DECISION_ENTRY) return entry.data;
    }
    return undefined;
  };

  const record = (names) => {
    state.names = names;
    pi.appendEntry(DECISION_ENTRY, {
      cwd: state.cwd,
      conditions: state.conditions,
      names,
    });
  };

  const announce = (ctx, kept, total) => {
    if (announced || !ctx.hasUI) return;
    announced = true;
    const labels = state.conditions.length > 0 ? state.conditions.join(", ") : "none";
    ctx.ui.notify(`skills: ${kept}/${total} kept (${labels})`, "info");
  };

  pi.on("session_start", (event, ctx) => {
    const prior = readPrior(ctx);
    const replayable =
      REPLAY_REASONS.has(event.reason) &&
      prior !== undefined &&
      prior.cwd === ctx.cwd &&
      Array.isArray(prior.names) &&
      Array.isArray(prior.conditions);

    if (replayable) {
      state = { cwd: prior.cwd, conditions: prior.conditions, names: prior.names };
      return;
    }

    state = { cwd: ctx.cwd, conditions: detectConditions(ctx.cwd).conditions, names: undefined };
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!state) return;
    const skills = event.systemPromptOptions.skills;
    if (!Array.isArray(skills)) return;

    if (!state.names) record(selectSkills(skills, state.conditions).map((skill) => skill.name));

    const keep = new Set(state.names);
    const filtered = skills.filter((skill) => keep.has(skill.name));
    event.systemPromptOptions.skills = filtered;
    announce(ctx, filtered.length, skills.length);
  });
}
