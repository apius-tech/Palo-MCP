import { cpSync, rmSync } from "fs";
import { spawnSync } from "child_process";

// Copy manifest, icon, and license into the extension directory
cpSync("manifest.json", "extension/manifest.json");
cpSync("icon.png", "extension/icon.png");
cpSync("LICENSE", "extension/LICENSE");

const files = ["manifest.json", "icon.png", "LICENSE", "server/index.cjs", "server/core_bg.wasm"];
rmSync("panos-mcp.mcpb", { force: true });

function packWithZip() {
  return spawnSync("zip", ["-r", "../panos-mcp.mcpb", ...files], {
    cwd: "extension",
    stdio: "inherit",
  });
}

function packWithPowerShell() {
  const literalPaths = ["manifest.json", "icon.png", "LICENSE", "server"]
    .map((file) => `'${file.replace(/'/g, "''")}'`)
    .join(", ");
  const command = [
    "$dest = Join-Path (Get-Location).Path '..\\panos-mcp.mcpb'",
    `Compress-Archive -LiteralPath ${literalPaths} -DestinationPath $dest -Force`,
  ].join("; ");

  return spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: "extension",
    stdio: "inherit",
  });
}

// Create .mcpb zip from extension/ contents (cwd handles the directory)
let result = packWithZip();
if (result.error && result.error.code === "ENOENT" && process.platform === "win32") {
  result = packWithPowerShell();
}
if (result.status !== 0) process.exit(result.status ?? 1);

// Clean up the extension directory
rmSync("extension", { recursive: true, force: true });

console.log("Packaged: panos-mcp.mcpb");
