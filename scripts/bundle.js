import { build } from "esbuild";

// Usage: node scripts/bundle.js [outfile]. The .mcpb pipeline uses the default;
// scripts/build-plugin.js passes its own output path.
const outfile = process.argv[2] ?? "extension/server/index.cjs";

await build({
  entryPoints: ["dist/index.js"],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["@napi-rs/keyring"],
});

console.log(`Bundle created: ${outfile}`);
