// Version helpers shared by the local release (scripts/release.js) and the
// automated one (scripts/ci-release.js).
//
// The latest v* tag is the source of truth for "what was released". CI releases
// can't push the version bump to the protected main branch, so after one the
// version in package.json lags behind the tag until the next local release.
import { readFileSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";

const VERSIONED_FILES = ["manifest.json", "src/index.ts"];

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return { status: result.status ?? 1, stdout: (result.stdout || "").trim() };
}

function parse(version) {
  return version.split(".").map(Number);
}

function compare(a, b) {
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function fileVersion() {
  return JSON.parse(readFileSync("package.json", "utf8")).version;
}

/** Highest v* tag, e.g. "v1.3.32", or null when the repo has none. */
export function latestTag() {
  const { stdout } = git(["tag", "--list", "v*", "--sort=-v:refname"]);
  return stdout.split("\n").find((tag) => /^v\d+\.\d+\.\d+$/.test(tag)) ?? null;
}

/** Version the next release gets: bumpType applied to max(latest tag, package.json). */
export function nextVersion(bumpType) {
  const tag = latestTag();
  const current = fileVersion();
  const base = tag && compare(tag.slice(1), current) > 0 ? tag.slice(1) : current;
  const [major, minor, patch] = parse(base);
  if (bumpType === "major") return `${major + 1}.0.0`;
  if (bumpType === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** Write newVersion into package.json, package-lock.json, manifest.json and src/index.ts. */
export function applyVersion(newVersion) {
  const current = fileVersion();
  const npm = spawnSync(
    "npm",
    ["version", newVersion, "--no-git-tag-version", "--allow-same-version"],
    { stdio: "inherit" }
  );
  if (npm.status !== 0) process.exit(npm.status ?? 1);
  for (const file of VERSIONED_FILES) {
    const contents = readFileSync(file, "utf8");
    if (!contents.includes(`"${current}"`)) {
      console.error(`${file} does not contain version "${current}" — refusing to guess.`);
      process.exit(1);
    }
    writeFileSync(file, contents.replace(`"${current}"`, `"${newVersion}"`));
  }
}

/**
 * Whether anything that ships in the .mcpb bundle's dependency tree changed
 * between ref and the working tree: package.json dependencies or any
 * non-dev package-lock entry. Dev-only bumps (vitest, @types/node) don't count.
 */
export function productionDepsChanged(ref) {
  const oldPkg = git(["show", `${ref}:package.json`]);
  const oldLock = git(["show", `${ref}:package-lock.json`]);
  if (oldPkg.status !== 0 || oldLock.status !== 0) return true;

  const deps = (pkg) => JSON.stringify(pkg.dependencies ?? {});
  const prodPackages = (lock) => {
    const packages = { ...lock.packages };
    delete packages[""];
    const prod = Object.entries(packages).filter(([, meta]) => !meta.dev);
    return JSON.stringify(prod.map(([path, meta]) => [path, meta.version, meta.integrity]));
  };

  const newPkg = JSON.parse(readFileSync("package.json", "utf8"));
  const newLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  return (
    deps(JSON.parse(oldPkg.stdout)) !== deps(newPkg)
    || prodPackages(JSON.parse(oldLock.stdout)) !== prodPackages(newLock)
  );
}
