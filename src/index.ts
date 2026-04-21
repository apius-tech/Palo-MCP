#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadFirewallConfig } from "./config/firewalls.js";

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
  version: "1.3.15",
});

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
  await loadFirewallConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
