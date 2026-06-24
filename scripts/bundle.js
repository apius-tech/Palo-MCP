import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

await build({
  entryPoints: ["dist/index.js"],
  outfile: "extension/server/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["@napi-rs/keyring"],
});

const root = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync("extension/server", { recursive: true });
copyFileSync(
  `${root}/node_modules/@1password/sdk-core/nodejs/core_bg.wasm`,
  "extension/server/core_bg.wasm"
);

console.log("Bundle created: extension/server/index.cjs");
