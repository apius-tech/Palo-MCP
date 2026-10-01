// Assembles the Claude plugin (directory listing "apius-panos") into
// build/plugin/ from the sources in plugin/ plus a fresh server bundle.
//
// The result is what users install, so it's built from an explicit file list
// (no stray .DS_Store, no package.json/lockfile that would make Claude Code run
// npm install). The version is stamped from package.json at build time, so
// plugin/.claude-plugin/plugin.json never needs bumping by hand.
//
// Expects dist/ to be built (npm run build). Publish with scripts/publish-plugin.js.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";

const PLUGIN_DIR = "build/plugin";

const FILES = [
  ["plugin/.mcp.json", ".mcp.json"],
  ["plugin/README.md", "README.md"],
  ["plugin/skills", "skills"],
  ["LICENSE", "LICENSE"],
];

rmSync(PLUGIN_DIR, { recursive: true, force: true });
mkdirSync(`${PLUGIN_DIR}/.claude-plugin`, { recursive: true });

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("plugin/.claude-plugin/plugin.json", "utf8"));
// Put version right after name so the manifest reads naturally.
const { name, ...rest } = manifest;
writeFileSync(
  `${PLUGIN_DIR}/.claude-plugin/plugin.json`,
  JSON.stringify({ name, version, ...rest }, null, 2) + "\n"
);

for (const [from, to] of FILES) {
  cpSync(from, `${PLUGIN_DIR}/${to}`, {
    recursive: true,
    filter: (src) => !/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/.test(src),
  });
}

const bundle = spawnSync("node", ["scripts/bundle.js", `${PLUGIN_DIR}/server/index.cjs`], {
  stdio: "inherit",
});
if (bundle.status !== 0) process.exit(bundle.status ?? 1);

console.log(`Plugin ${name} v${version} assembled in ${PLUGIN_DIR}/`);
