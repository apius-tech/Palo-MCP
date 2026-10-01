// Publishes build/plugin/ (see scripts/build-plugin.js) as a new commit on the
// claude-plugin branch, which Anthropic's plugin directory tracks.
//
// The plugin ships a built server bundle, and main is protected — CI releases
// (scripts/ci-release.js) can't commit to it. A separate branch holding only
// the assembled plugin at its root lets both release paths keep the directory
// current, and keeps the 3 MB bundle out of main's history.
//
// Uses git plumbing with a throwaway index, so the working tree and the current
// branch are never touched.
//
// Flags: --dry-run creates the commit locally but doesn't push it.
import { readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";

const BRANCH = "claude-plugin";
const PLUGIN_DIR = "build/plugin";
const INDEX_FILE = "build/plugin.index";
const dryRun = process.argv.includes("--dry-run");

function git(args, env = {}, cwd = undefined) {
  const result = spawnSync("git", args, { encoding: "utf8", cwd, env: { ...process.env, ...env } });
  return { status: result.status ?? 1, stdout: (result.stdout || "").trim(), stderr: result.stderr || "" };
}

function mustGit(args, env, cwd) {
  const result = git(args, env, cwd);
  if (result.status !== 0) {
    console.error(`git ${args.join(" ")} failed:\n${result.stderr}`);
    process.exit(result.status);
  }
  return result.stdout;
}

const inCi = process.env.GITHUB_ACTIONS === "true";
if (inCi) {
  // Checkout runs with persist-credentials: false; authenticate this push only.
  const setup = spawnSync("gh", ["auth", "setup-git"], { stdio: "inherit" });
  if (setup.status !== 0) process.exit(setup.status ?? 1);
}
const identity = inCi
  ? {
      GIT_AUTHOR_NAME: "github-actions[bot]",
      GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
      GIT_COMMITTER_NAME: "github-actions[bot]",
      GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
    }
  : {};

const { version } = JSON.parse(readFileSync(`${PLUGIN_DIR}/.claude-plugin/plugin.json`, "utf8"));
const sourceSha = mustGit(["rev-parse", "HEAD"]);

// The branch may not exist yet; the first publish creates it as an orphan.
// ls-remote exits 2 when the ref is missing; any other failure is a real error.
const remote = git(["ls-remote", "--exit-code", "origin", `refs/heads/${BRANCH}`]);
if (remote.status !== 0 && remote.status !== 2) {
  console.error(`Couldn't query origin for ${BRANCH}:\n${remote.stderr}`);
  process.exit(remote.status);
}
let parent = null;
if (remote.status === 0) {
  mustGit(["fetch", "--quiet", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
  parent = mustGit(["rev-parse", `refs/remotes/origin/${BRANCH}`]);
}

rmSync(INDEX_FILE, { force: true });
const treeEnv = {
  GIT_DIR: resolve(mustGit(["rev-parse", "--git-dir"])),
  GIT_INDEX_FILE: resolve(INDEX_FILE),
  GIT_WORK_TREE: resolve(PLUGIN_DIR),
};
// --force: the folder is assembled from an explicit list, so ignore rules
// (including the user's global excludes) must not drop anything from it.
mustGit(["add", "--all", "--force", "."], treeEnv, PLUGIN_DIR);
const tree = mustGit(["write-tree"], treeEnv, PLUGIN_DIR);
rmSync(INDEX_FILE, { force: true });

if (parent && mustGit(["rev-parse", `${parent}^{tree}`]) === tree) {
  console.log(`${BRANCH} already has this exact plugin content — nothing to publish.`);
  process.exit(0);
}

const message = `apius-panos v${version}\n\nBuilt from ${sourceSha} by scripts/publish-plugin.js.`;
const commit = mustGit(
  ["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", message],
  identity
);

if (dryRun) {
  console.log(`[dry-run] Would push ${commit.slice(0, 7)} (v${version}) to ${BRANCH}.`);
  process.exit(0);
}

const push = spawnSync("git", ["push", "origin", `${commit}:refs/heads/${BRANCH}`], { stdio: "inherit" });
if (push.status !== 0) process.exit(push.status ?? 1);
console.log(`Published plugin v${version} to ${BRANCH} (${commit.slice(0, 7)}).`);
