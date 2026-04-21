import { build } from "esbuild";

await build({
  entryPoints: ["dist/index.js"],
  outfile: "extension/server/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["@napi-rs/keyring"],
});

console.log("Bundle created: extension/server/index.cjs");
