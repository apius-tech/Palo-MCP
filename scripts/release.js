import { readFileSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";

const args = process.argv.slice(2);
const allowRedCi = args.includes("--allow-red-ci");
const bumpType = args.find((arg) => !arg.startsWith("--")) ?? "patch";
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error(`Unknown bump type "${bumpType}". Use patch, minor, or major.`);
  process.exit(1);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return { status: result.status ?? 1, stdout: (result.stdout || "").trim() };
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Latest state of the CI workflow for a commit: {status, conclusion}, or null
 * when GitHub has no run for it (nothing pushed, or the workflow never fired).
 *
 * Deliberately the workflow run and not the "CI" check — that check is the
 * aggregating job, so it only appears once the test matrix has finished, and a
 * commit whose tests are still running would otherwise look like no CI at all.
 */
function ciCheck(sha) {
  const result = runCapture("gh", [
    "api",
    `repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha=${sha}`,
    "--jq",
    '.workflow_runs | sort_by(.run_started_at) | last '
      + '| if . == null then empty else "\(.status) \(.conclusion // "")" end',
  ]);
  if (result.status !== 0 || result.stdout.length === 0) return null;
  const [status, conclusion] = result.stdout.split(" ");
  return { status, conclusion: conclusion || null };
}

/** Poll until the CI check for sha finishes. Returns its conclusion, or null on timeout. */
function waitForCi(sha, timeoutMs = 20 * 60 * 1000, intervalMs = 20 * 1000) {
  const deadline = Date.now() + timeoutMs;
  let announced = false;
  while (Date.now() < deadline) {
    const check = ciCheck(sha);
    if (check?.status === "completed") return check.conclusion;
    if (!announced) {
      console.log(`Waiting for CI on ${sha.slice(0, 7)}...`);
      announced = true;
    }
    sleep(intervalMs);
  }
  return null;
}

const status = runCapture("git", ["status", "--porcelain"]);
if (status.stdout.length > 0) {
  console.error("Working tree is not clean. Commit or stash changes before releasing.");
  process.exit(1);
}

// Never cut a release from a commit CI has not blessed. --allow-red-ci skips
// both this pre-flight and the post-push wait below.
if (!allowRedCi) {
  const headSha = runCapture("git", ["rev-parse", "HEAD"]).stdout;
  const check = ciCheck(headSha);
  if (!check) {
    console.error(
      `No CI run found for HEAD (${headSha.slice(0, 7)}). Push the commit and let CI run, `
        + "or pass --allow-red-ci to release anyway."
    );
    process.exit(1);
  }
  if (check.status !== "completed") {
    console.error(`CI is still ${check.status} for HEAD (${headSha.slice(0, 7)}). Wait for it to finish.`);
    process.exit(1);
  }
  if (check.conclusion !== "success") {
    console.error(
      `CI concluded "${check.conclusion}" for HEAD (${headSha.slice(0, 7)}). `
        + "Fix it before releasing, or pass --allow-red-ci."
    );
    process.exit(1);
  }
}

const oldVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const oldTag = `v${oldVersion}`;

const log = runCapture("git", ["log", `${oldTag}..HEAD`, "--oneline"]);
const changelog = log.status === 0 && log.stdout.length > 0
  ? log.stdout
  : "(no commits found since previous tag)";

run("npm", ["version", bumpType, "--no-git-tag-version"]);
const newVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const newTag = `v${newVersion}`;

for (const file of ["manifest.json", "src/index.ts"]) {
  const contents = readFileSync(file, "utf8");
  writeFileSync(file, contents.replace(`"${oldVersion}"`, `"${newVersion}"`));
}

run("npm", ["run", "pack:extension"]);

run("git", ["add", "package.json", "package-lock.json", "manifest.json", "src/index.ts"]);
run("git", ["commit", "-m", `chore: release ${newTag}\n\n${changelog}`]);
run("git", ["tag", newTag]);
run("git", ["push", "origin", "main"]);
run("git", ["push", "origin", newTag]);

// The release commit itself gets a fresh CI run — the tag is already pushed, so
// publish the GitHub release only once that run is green.
if (!allowRedCi) {
  const releaseSha = runCapture("git", ["rev-parse", "HEAD"]).stdout;
  const conclusion = waitForCi(releaseSha);
  if (conclusion !== "success") {
    console.error(
      `CI for the release commit ${conclusion ? `concluded "${conclusion}"` : "did not finish in time"}. `
        + `${newTag} is pushed and tagged, but no GitHub release was created. Fix CI, then run:\n`
        + `  gh release delete ${oldTag} --yes && gh release create ${newTag} panos-mcp.mcpb --title ${newTag}`
    );
    process.exit(1);
  }
}

const oldRelease = runCapture("gh", ["release", "view", oldTag]);
if (oldRelease.status === 0) {
  run("gh", ["release", "delete", oldTag, "--yes"]);
}

run("gh", [
  "release", "create", newTag, "panos-mcp.mcpb",
  "--title", newTag,
  "--notes", `Changes since ${oldTag}:\n\n${changelog}`,
]);

console.log(`Released ${newTag}`);
