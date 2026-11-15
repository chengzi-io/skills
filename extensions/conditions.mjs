/**
 * Project condition detection.
 *
 * A condition is a fact about the working tree that makes a plugin's skills
 * relevant. Conditions are additive: a Go service with a React frontend
 * satisfies both `go` and `ui`. Skills whose plugin has no condition are
 * always kept, so an unregistered plugin is never filtered by accident.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MAX_DEPTH = 6;
export const MAX_ENTRIES = 20000;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "build",
  "dist",
  "vendor",
  "Pods",
  "DerivedData",
  ".build",
  ".gradle",
  ".venv",
  "venv",
  "__pycache__",
  ".next",
  ".nuxt",
  ".turbo",
  ".yarn",
  "coverage",
  "obj",
  "bin",
]);

/** Plugin directory name -> the condition that must hold for its skills. */
export const PLUGIN_CONDITION = {
  golang: "go",
  rust: "rust",
  python: "python",
  java: "java",
  swift: "swift",
  macos: "macos",
  typescript: "node",
  web: "ui",
};

const UI_DEPS = [
  "react",
  "react-dom",
  "vue",
  "svelte",
  "@angular/core",
  "@sveltejs/kit",
  "solid-js",
  "astro",
  "next",
  "nuxt",
  "preact",
];

const MARKERS = [
  { condition: "go", test: (p) => /(^|\/)(go\.mod|go\.work)$/.test(p) },
  { condition: "rust", test: (p) => /(^|\/)Cargo\.toml$/.test(p) },
  {
    condition: "python",
    test: (p) =>
      /(^|\/)(pyproject\.toml|setup\.py|Pipfile|uv\.lock|poetry\.lock)$/.test(p) ||
      /(^|\/)requirements[^/]*\.txt$/.test(p),
  },
  {
    condition: "java",
    test: (p) => /(^|\/)(pom\.xml|build\.gradle|build\.gradle\.kts|settings\.gradle|settings\.gradle\.kts)$/.test(p),
  },
  { condition: "swift", test: (p) => /(^|\/)Package\.swift$/.test(p) || /\.(xcodeproj|xcworkspace)$/.test(p) },
  { condition: "macos", test: (p) => p.endsWith(".entitlements") },
  { condition: "node", test: (p) => /(^|\/)package\.json$/.test(p) },
];

/** List every file and directory below `root`, bounded by depth and entry count. */
function walk(root) {
  const paths = [];
  const stack = [["", 0]];
  let seen = 0;

  while (stack.length > 0 && seen < MAX_ENTRIES) {
    const [rel, depth] = stack.pop();
    const dir = rel ? join(root, rel) : root;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      continue;
    }
    for (const entry of entries) {
      seen += 1;
      if (seen > MAX_ENTRIES) break;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        paths.push(relPath);
        if (depth < MAX_DEPTH && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          stack.push([relPath, depth + 1]);
        }
      } else if (entry.isFile()) {
        paths.push(relPath);
      }
    }
  }

  return paths;
}

function readText(root, rel, maxBytes) {
  try {
    const buf = readFileSync(join(root, rel));
    if (buf.byteLength > maxBytes) return undefined;
    return buf.toString("utf-8");
  } catch {
    return undefined;
  }
}

function readDeps(root, rel) {
  const text = readText(root, rel, 1_000_000);
  if (text === undefined) return undefined;
  try {
    const pkg = JSON.parse(text);
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
  } catch {
    return undefined;
  }
}

/**
 * Detect which conditions hold for the project at `root`.
 * Returns the conditions and, per condition, the path that proved it.
 */
export function detectConditions(root) {
  const paths = walk(root);
  const evidence = {};
  const hit = (condition, path) => {
    if (evidence[condition] === undefined) evidence[condition] = path;
  };

  for (const path of paths) {
    for (const marker of MARKERS) {
      if (marker.test(path) && evidence[marker.condition] === undefined) {
        hit(marker.condition, path);
      }
    }
  }

  const swiftPlatforms = paths.filter((p) => /(^|\/)Package\.swift$/.test(p));
  for (const path of swiftPlatforms) {
    if (evidence.macos !== undefined) break;
    const text = readText(root, path, 1_000_000);
    const platforms = text?.match(/platforms\s*:\s*\[([\s\S]{0,400}?)\]/);
    if (platforms && /\.macOS\s*\(/.test(platforms[1])) hit("macos", `${path}: platforms .macOS`);
  }

  if (evidence.macos === undefined) {
    for (const path of paths.filter((p) => /(^|\/)project\.pbxproj$/.test(p))) {
      const text = readText(root, path, 4_000_000);
      if (text && /SDKROOT\s*=\s*macosx/.test(text)) {
        hit("macos", `${path}: SDKROOT = macosx`);
        break;
      }
    }
  }

  for (const path of paths.filter((p) => /(^|\/)package\.json$/.test(p))) {
    if (evidence.ui !== undefined) break;
    const deps = readDeps(root, path);
    if (!deps) continue;
    const found = Object.keys(deps).filter((dep) => UI_DEPS.some((ui) => dep === ui || dep.startsWith(`${ui}/`)));
    if (found.length > 0) hit("ui", `${path}: ${found.slice(0, 3).join(", ")}`);
  }

  return { conditions: Object.keys(evidence).sort(), evidence };
}

/** Plugin that owns `filePath`, or undefined when the skill lives outside this package. */
export function pluginOf(filePath) {
  const match = /[\\/]plugins[\\/]([^\\/]+)[\\/]skills[\\/]/.exec(filePath ?? "");
  return match ? match[1] : undefined;
}

/** Keep a skill unless its plugin declares a condition the project does not satisfy. */
export function selectSkills(skills, conditions) {
  const active = new Set(conditions);
  return skills.filter((skill) => {
    const plugin = pluginOf(skill.filePath);
    if (plugin === undefined) return true;
    const required = PLUGIN_CONDITION[plugin];
    if (required === undefined) return true;
    return active.has(required);
  });
}
