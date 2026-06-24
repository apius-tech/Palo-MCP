#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  getExpectedEnvironmentVariableNames,
  loadFirewallConfig,
  setInjectedEnvironment,
} from "./config/firewalls.js";
import { isKeychainAvailable } from "./config/keychain.js";
import { loadOnePasswordEnvironment } from "./config/onepassword.js";
import { describeProxy } from "./api/proxy.js";

import { registerFirewallTools } from "./tools/firewalls.js";
import { registerSystemTools } from "./tools/system.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerSecurityTools } from "./tools/security.js";
import { registerObjectsTools } from "./tools/objects.js";
import { registerNatTools } from "./tools/nat.js";
import { registerUserIdTools } from "./tools/userid.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerVpnTools } from "./tools/vpn.js";
import { registerPanoramaTools } from "./tools/panorama.js";
import { registerLogsTools } from "./tools/logs.js";
import { registerThreatTools } from "./tools/threat.js";
import { registerCertificatesTools } from "./tools/certificates.js";
import { registerLicensesTools } from "./tools/licenses.js";
import { registerConfigTools } from "./tools/config.js";
import { registerUtilityTools } from "./tools/utility.js";

const server = new McpServer({
  name: "panos-mcp",
  version: "1.3.20",
});

// Wrap all tool handlers to catch unexpected errors cleanly
const _tool = server.tool.bind(server);
(server.tool as any) = function (...args: any[]) {
  const last = args.length - 1;
  const handler = args[last];
  args[last] = async (...hArgs: any[]) => {
    try {
      return await handler(...hArgs);
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  };
  return (_tool as (...a: any[]) => any)(...args);
};

// Register all tools
registerFirewallTools(server);
registerSystemTools(server);
registerNetworkTools(server);
registerSecurityTools(server);
registerObjectsTools(server);
registerNatTools(server);
registerUserIdTools(server);
registerAdminTools(server);
registerVpnTools(server);
registerPanoramaTools(server);
registerLogsTools(server);
registerThreatTools(server);
registerCertificatesTools(server);
registerLicensesTools(server);
registerConfigTools(server);
registerUtilityTools(server);

async function main() {
  const onePasswordEnvironment = await loadOnePasswordEnvironment({
    allowedNames: getExpectedEnvironmentVariableNames(),
  });
  setInjectedEnvironment(onePasswordEnvironment);
  if (onePasswordEnvironment.size > 0) {
    process.stderr.write(
      `[panos-mcp] Loaded ${onePasswordEnvironment.size} environment variable(s) from 1Password Environment\n`
    );
  }

  await loadFirewallConfig();
  if (!isKeychainAvailable()) {
    process.stderr.write(
      "[panos-mcp] WARNING: System keychain unavailable — API keys are stored in plaintext. " +
      "Install a keychain provider (macOS Keychain, libsecret on Linux, Windows Credential Manager) " +
      "and re-run `panos-mcp keygen` to migrate keys to secure storage.\n"
    );
  }
  const proxy = describeProxy();
  if (proxy) {
    console.error(`PanOS proxy: ${proxy}`);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
