# PanOS MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/apius-tech/Palo-MCP)](https://github.com/apius-tech/Palo-MCP/stargazers)
[![Tests](https://img.shields.io/badge/tests-109%20passing-brightgreen)](https://github.com/apius-tech/Palo-MCP/actions)
[![GitHub release](https://img.shields.io/github/v/release/apius-tech/Palo-MCP)](https://github.com/apius-tech/Palo-MCP/releases/latest)

**Control your Palo Alto Networks firewall with AI.** PanOS MCP is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that connects AI assistants — Claude, Cursor, and others — directly to PAN-OS firewalls and Panorama via the PAN-OS XML API. Ask questions, inspect policies, and make configuration changes in plain English instead of navigating the GUI or writing API scripts.

Supports **PA-Series firewalls** (PA-220, PA-415, PA-440, PA-445, PA-450, PA-460, PA-1400, PA-3400, PA-5400, PA-7500 and more), **VM-Series**, **CN-Series**, and **Panorama** — any device running PAN-OS with API access enabled.

> **Warning:** This server gives an AI model direct access to your firewall configuration via the PanOS API. AI models can make mistakes, misinterpret instructions, or take unintended actions that may disrupt network traffic, modify security policies, or cause outages. **Use at your own risk.** Always review AI-proposed changes before committing, use a read-only API key where possible, and never run against production firewalls without understanding the consequences.

**117 tools across 16 modules** covering firewall management, monitoring, and configuration changes — all from within your AI assistant.

## What you can do

Talk to your firewall in plain English. Some examples:

- *"Show me all security rules that allow traffic from the internet to the DMZ"*
- *"Which GlobalProtect users are currently connected?"*
- *"Create an address object for 10.10.0.0/24 called corp-network and add it to the allow-internal group"*
- *"Check HA status — is the standby firewall in sync?"*
- *"Show me the last 50 threat log entries"*
- *"Move the block-social-media rule above the allow-web rule and commit"*
- *"List all IPSec tunnels and their current state"*
- *"What software version is running on each managed device in Panorama?"*

## Features

- **Read-only inspection** of firewall state, policies, objects, logs, and more
- **Configuration management** via XPath-based set/delete with staged commits
- **Panorama support** for centralized management of device groups, templates, and shared objects
- **Multi-firewall mode** — manage multiple PA-Series devices or Panorama instances simultaneously
- **Secure credential storage** — API keys stored in the OS keychain, never in plaintext
- **Input validation** with Zod schemas for early error detection
- **Safety labels** on every tool: `[READ-ONLY]`, `[MODIFIES CONFIG]`, or `[ADVANCED]`

## Prerequisites

- Node.js 22.19+
- A PanOS firewall or Panorama appliance with API access enabled
- A PanOS API key ([how to generate](https://docs.paloaltonetworks.com/pan-os/11-1/pan-os-panorama-api/get-started-with-the-pan-os-xml-api/get-your-api-key))

To generate a PanOS API key directly from a firewall, use the XML API keygen endpoint:

```bash
curl -k -X GET 'https://<FIREWALL_IP_OR_HOST>/api/?type=keygen&user=<USERNAME>&password=<PASSWORD>'
```

This sends credentials in the request URL and skips TLS certificate verification. Use it only from a trusted management network, and prefer a scoped or read-only API key where possible.

## Quick Start

> **Single firewall vs. multi-firewall:** The Desktop Extension supports **one firewall** configured at install time. For managing multiple firewalls or Panorama instances simultaneously, use the npx or Claude Code CLI installation with the `panos-keygen` setup described in [Multiple firewalls](#multiple-firewalls).

### Claude Desktop — Desktop Extension (single firewall)

1. Download the latest `panos-mcp.mcpb` from [Releases](https://github.com/apius-tech/Palo-MCP/releases)
2. Double-click the file — Claude Desktop opens an install dialog
3. Enter your **Firewall Host** and **API Key** when prompted

The API key is stored securely in your OS keychain, not in plaintext config files.

### Claude Desktop — npx (single or multiple firewalls)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "panos": {
      "command": "npx",
      "args": ["-y", "github:apius-tech/Palo-MCP"],
      "env": {
        "PANOS_HOST": "your-firewall-or-panorama",
        "PANOS_API_KEY": "your-api-key"
      }
    }
  }
}
```

Config file location: **macOS** `~/Library/Application Support/Claude/claude_desktop_config.json` · **Windows** `%APPDATA%\Claude\claude_desktop_config.json`

### Claude Code (CLI)

```bash
claude mcp add panos -- npx -y github:apius-tech/Palo-MCP \
  --env PANOS_HOST=your-firewall-or-panorama \
  --env PANOS_API_KEY=your-api-key
```

### Cursor

Open Cursor Settings (Ctrl+Shift+J) → MCP → Add new MCP server, or add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "panos": {
      "command": "npx",
      "args": ["-y", "github:apius-tech/Palo-MCP"],
      "env": {
        "PANOS_HOST": "your-firewall-or-panorama",
        "PANOS_API_KEY": "your-api-key"
      }
    }
  }
}
```

Replace `your-firewall-or-panorama` with your firewall/Panorama IP or hostname, and `your-api-key` with your PanOS API key.

## Multiple firewalls

For managing more than one firewall or Panorama, use the `panos-keygen` CLI to register each one. It generates an API key, stores it in your OS keychain, and writes the host entry to `~/.config/panos-mcp/firewalls.json`:

```bash
npx panos-keygen --host fw-hq.example.com     --user admin --name hq-fw
npx panos-keygen --host fw-branch.example.com --user admin --name branch-fw
npx panos-keygen --host panorama.example.com  --user admin --name panorama
```

You will be prompted for the password. The API key is stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) — never in the JSON file.

If you already have API keys, you can write them directly to `firewalls.json` with `api_key` fields — they will be auto-migrated to the keychain on the next server startup:

```json
{
  "firewalls": [
    { "name": "hq-fw",  "host": "fw-hq.example.com",  "api_key": "LUFRPT1..." },
    { "name": "panorama", "host": "panorama.example.com", "api_key": "LUFRPT2..." }
  ]
}
```

Override the config path with `PANOS_FIREWALLS_CONFIG=/custom/path.json` if needed. `name` is the identifier you pass to tools (max 63 chars); `host` may include or omit the `https://` prefix.

When multiple entries are configured, every tool accepts a `firewall: <name>` parameter — required in multi-mode, optional when a single entry or `PANOS_HOST`/`PANOS_API_KEY` env vars are used. Ask the model to call `list_firewalls` to see which targets are configured.

> **Linux headless servers:** If no keychain daemon is available (e.g. servers without `libsecret`), API keys fall back to plaintext in `firewalls.json` with a warning. Restrict the file with `chmod 600 ~/.config/panos-mcp/firewalls.json` in that case.

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| System | 4 | Firewall info, HA status, sessions, resources |
| Network | 10 | Interfaces, zones, routing, ARP, VLANs, DHCP, DNS proxy, static routes (get, add, delete) |
| Security | 18 | Security rules CRUD, profiles, profile groups, PBF rules CRUD, DoS, QoS rules CRUD |
| Objects | 16 | Address/service objects and groups (get, add, delete), application filters, tags (get, add, delete) |
| NAT | 5 | NAT rules (get, add, move, delete, enable/disable) |
| User-ID | 3 | User-IP mappings, groups, config |
| Admin | 3 | Admins, roles, auth profiles |
| VPN | 3 | IPSec tunnels, GlobalProtect users and config |
| Panorama | 29 | Device groups, templates, shared objects, pre/post rules CRUD, DG NAT rules CRUD, push status, HA |
| Logs | 5 | Traffic, threat, system, URL, and config logs |
| Threat | 4 | WildFire, antivirus, content versions, URL categories |
| Certificates | 7 | Certificates, decryption rules (get, add, move, delete, enable/disable) and profiles |
| Licenses | 2 | License info and usage |
| Config | 5 | Set/delete config, commit, Panorama commit, Panorama push |
| Utility | 2 | Arbitrary op commands, XPath config reads |
| Firewalls | 1 | List configured firewall targets |

## Safety Labels

Every tool is labeled to indicate its impact:

- **`[READ-ONLY]`** — Only reads data; no changes to the firewall
- **`[MODIFIES CONFIG]`** — Stages or commits configuration changes that affect live traffic
- **`[ADVANCED]`** — Accepts arbitrary commands; impact depends on the input

## API Key

Generate a PanOS API key from the firewall web UI or CLI:

**Web UI:** Device → Administrators → your admin user → Generate API Key

**CLI:**
```bash
curl -k 'https://YOUR-FIREWALL/api/?type=keygen&user=admin&password=YOUR-PASSWORD'
```

See [PanOS documentation](https://docs.paloaltonetworks.com/pan-os/11-1/pan-os-panorama-api/get-started-with-the-pan-os-xml-api/get-your-api-key) for details.

## Proxy support

If your firewall is reachable only via a proxy (management network behind a jump host, remote access via SOCKS5, corporate HTTP proxy), set one of the following environment variables before starting the server:

| Variable | Purpose |
|---|---|
| `PANOS_PROXY` | **Explicit override.** Used regardless of `NO_PROXY`. Recommended for MCP deployments. |
| `HTTPS_PROXY` / `https_proxy` | Standard — same semantics as most HTTP clients. |
| `HTTP_PROXY` / `http_proxy` | Fallback. |
| `ALL_PROXY` / `all_proxy` | Fallback (common for SOCKS). |
| `NO_PROXY` / `no_proxy` | Comma-separated list of hostnames/suffixes to bypass. `*` disables proxying entirely. Ignored when `PANOS_PROXY` is set. |

Supported URL schemes:

- `http://[user:pass@]host:port` — HTTP CONNECT proxy
- `https://[user:pass@]host:port` — HTTPS CONNECT proxy
- `socks5://[user:pass@]host:port` — SOCKS5, **client-side** DNS
- `socks5h://[user:pass@]host:port` — SOCKS5, **proxy-side** DNS (use this when the firewall hostname only resolves on the far side of the proxy)
- `socks4://[user@]host:port` / `socks4a://[user@]host:port`

Example — SOCKS5 with remote DNS:

```bash
export PANOS_PROXY=socks5h://10.0.1.168:2080
```

Self-signed firewall certificates are accepted through the proxy tunnel (the server already disables cert validation for the PanOS target).

## Development

```bash
git clone https://github.com/apius-tech/Palo-MCP.git
cd Palo-MCP
npm install
cp .env.example .env   # fill in PANOS_HOST and PANOS_API_KEY
```

```bash
npm run build           # compile TypeScript
npm run dev             # watch mode (rebuild on changes)
npm test                # run tests
npm run start           # run the server
npm run pack:extension  # build Desktop Extension (.mcpb)
```

## Examples

**"Show me the firewall system info"**

Uses `get_firewall_info` to retrieve hostname, model, serial number, and software version.

**"List all security rules on the firewall"**

Uses `get_security_rules` to retrieve the full security policy rulebase.

**"Create an address object for the 10.0.1.0/24 subnet called lab-network, then commit"**

Uses `set_config` to create the address object in the candidate configuration, then `commit` to activate the change on the running firewall.

## Privacy

- **No data collection** — This extension does not collect, store, or transmit any data to third parties.
- **Direct communication only** — All API calls go directly from your machine to your PanOS firewall or Panorama. No traffic is routed through intermediary servers.
- **Local credential storage** — API keys are stored in your OS keychain (Desktop Extension and multi-firewall mode via `panos-keygen`), or in local environment variables. They are never sent anywhere other than your firewall.
- **No telemetry or analytics** — This extension contains no tracking, telemetry, or analytics of any kind.
- **Data retention** — No data is retained by the extension or its authors. Firewall responses exist only transiently in memory to serve the active request and are not persisted, logged, or shared. The only data stored at rest is your API key, kept locally in your OS keychain or environment variables under your control.
- **Third-party sharing** — None. No data is shared with the authors, Anthropic, or any third party beyond the direct connection to your own firewall.
- **Contact** — For privacy questions or data requests, [open a GitHub issue](https://github.com/apius-tech/Palo-MCP/issues). Maintained by Apius Technologies SA.

## Disclaimer

This software is provided "as is", without warranty of any kind. This tool connects an AI model to live network infrastructure. AI models can hallucinate, misunderstand context, and execute unintended changes. The authors are not responsible for any damage, data loss, outages, or security incidents caused by the use of this software. You are solely responsible for any actions taken by the AI model through this server.

**Recommendations:**
- Test in a lab environment before using in production
- Use a read-only API key for inspection tasks
- Always review and confirm changes before committing
- Monitor firewall logs for unexpected configuration changes

## Security

Please **do not** open a public GitHub issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for private reporting via GitHub Private Vulnerability Reporting or email.

## License

MIT
