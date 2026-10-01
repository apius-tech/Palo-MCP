// Automated patch release, run by .github/workflows/release.yml after CI passes
// on main. Ships only when the production dependency tree changed since the
// last tag — that's how merged Dependabot fixes reach the .mcpb users install.
//
// Unlike scripts/release.js it commits nothing: main is protected and the
// workflow token can't push to it. The bump lives only in the tag and the
// bundle; the next local release catches package.json up (see version.js).
//
// Flags: --dry-run builds the bundle and the plugin but publishes nothing.
//        --force releases even when production dependencies are unchanged.
import { spawnSync } from "child_process";
import { appendFileSync } from "fs";
import { applyVersion, latestTag, nextVersion, productionDepsChanged } from "./version.js";

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return { status: result.status ?? 1, stdout: (result.stdout || "").trim() };
}

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

const sha = capture("git", ["rev-parse", "HEAD"]).stdout;
const oldTag = latestTag();
if (!oldTag) {
  console.error("No v* tag found — cut the first release locally with `npm run release`.");
  process.exit(1);
}

// Tag already on (or after) this commit: nothing new to ship. Also stops a
// re-run from releasing the same commit twice.
if (capture("git", ["merge-base", "--is-ancestor", sha, oldTag]).status === 0) {
  console.log(`${sha.slice(0, 7)} is already contained in ${oldTag} — nothing to release.`);
  output("released", "false");
  process.exit(0);
}

if (!force && !productionDepsChanged(oldTag)) {
  console.log(`Production dependencies unchanged since ${oldTag} — skipping release.`);
  output("released", "false");
  process.exit(0);
}

const newVersion = nextVersion("patch");
const newTag = `v${newVersion}`;
applyVersion(newVersion);
run("npm", ["run", "pack:extension"]);
run("npm", ["run", "build:plugin"]);
output("version", newVersion);

const log = capture("git", ["log", `${oldTag}..HEAD`, "--oneline"]);
const changelog = log.stdout || "(no commits found since previous tag)";

if (dryRun) {
  console.log(`[dry-run] Would release ${newTag} at ${sha.slice(0, 7)}:\n${changelog}`);
  run("node", ["scripts/publish-plugin.js", "--dry-run"]);
  output("released", "false");
  process.exit(0);
}

// --target creates the tag on the exact commit CI tested.
run("gh", [
  "release", "create", newTag, "panos-mcp.mcpb",
  "--target", sha,
  "--title", newTag,
  "--notes", `Automated release — production dependencies changed since ${oldTag}:\n\n${changelog}`,
]);

// Same policy as scripts/release.js: only the newest release carries a bundle.
if (capture("gh", ["release", "view", oldTag]).status === 0) {
  run("gh", ["release", "delete", oldTag, "--yes"]);
}

// The plugin directory tracks the claude-plugin branch, so Dependabot fixes
// reach plugin users too — main stays untouched (see publish-plugin.js).
run("node", ["scripts/publish-plugin.js"]);

output("released", "true");
console.log(`Released ${newTag}`);
