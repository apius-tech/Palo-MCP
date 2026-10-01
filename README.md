# PanOS MCP

Inspect and manage Palo Alto Networks PA-Series firewalls and Panorama from a conversation with Claude. The plugin runs the open-source [PanOS MCP server](https://github.com/apius-tech/Palo-MCP) locally and gives Claude 117 tools across security and NAT policy, address and service objects, routing, User-ID, IPSec and GlobalProtect VPN, logs, WildFire, certificates and decryption, licenses, and Panorama device groups and templates. It also ships a skill that makes Claude stage changes, show you the diff, and commit only after you confirm.

> **Warning:** this plugin gives Claude direct access to your firewall configuration through the PAN-OS XML API. Models make mistakes. Review every proposed change before it is committed, use an API key for a read-only admin role where you can, and don't point it at production firewalls without understanding the consequences.

## Where it runs

The MCP server is a local process started with `node`, so you need **Node.js 22.19 or later on your PATH**.

- **Claude Code**: fully supported. Claude Code prompts for the firewall host and API key when you enable the plugin.
- **Cowork (sessions on your computer)**: supported, but Cowork doesn't prompt for settings. Configure your firewalls in `~/.config/panos-mcp/firewalls.json` (see below).
- **Chat on claude.ai, the desktop app, and mobile**: local MCP servers don't run there. Only the skill loads.

## Set up

### Single firewall (Claude Code)

Enable the plugin and fill in:

- **Firewall host**: hostname or IP of the firewall or Panorama, for example `fw.example.com`
- **API key**: a PAN-OS XML API key for that host. Generate it in the firewall web UI under Device > Administrators > your admin > Generate API Key. Claude Code keeps it in your system's secure credential store.

### Several firewalls, or Cowork

Leave both settings empty and create `~/.config/panos-mcp/firewalls.json`:

```json
{
  "firewalls": [
    { "name": "hq-fw", "host": "fw-hq.example.com", "api_key": "<api-key-for-hq-fw>" },
    { "name": "panorama", "host": "panorama.example.com", "api_key": "<api-key-for-panorama>" }
  ]
}
```

Restrict it with `chmod 600 ~/.config/panos-mcp/firewalls.json`, because the plugin's bundled server can't reach the OS keychain and reads keys from this file in plaintext. For the same reason, keys that the standalone `panos-keygen` tool moved into your keychain aren't visible to the plugin: add `api_key` back to those entries. With more than one entry, every tool takes a `firewall` parameter. Ask Claude to run `list_firewalls` to see the configured targets. Set `PANOS_FIREWALLS_CONFIG` to use a different path.

If you set a host and API key in the plugin settings, they're used only when `firewalls.json` doesn't exist.

## Use it

Ask in plain language, for example:

- "Show me the security rules that allow traffic from untrust to the DMZ"
- "Which GlobalProtect users are connected right now?"
- "Find threat log entries from the last hour with critical severity"
- "Create an address object lab-net for 10.0.1.0/24 and add it to the lab-hosts group"
- "Disable the temp-vendor-access rule"

Changes are staged in the candidate configuration and only reach the running firewall when Claude calls `commit` (or, on Panorama, `panorama_commit` then `panorama_push_to_devices`). Every tool carries a label in its description: `[READ-ONLY]`, `[MODIFIES CONFIG]`, or `[ADVANCED]` for arbitrary operational commands.

## What the plugin runs and sends

- **Runs**: `node server/index.cjs`, a bundled build of the [PanOS MCP server](https://github.com/apius-tech/Palo-MCP) source in this repository's `main` branch. It doesn't download or install anything.
- **Sends**: HTTPS requests to the PAN-OS XML API of the firewall hosts you configure, carrying your API key and the queries and changes Claude makes. If `PANOS_PROXY`, `HTTPS_PROXY`, `HTTP_PROXY`, or `ALL_PROXY` is set in your environment, requests go through that proxy.
- **Reads**: the plugin settings above and `~/.config/panos-mcp/firewalls.json` (or the path in `PANOS_FIREWALLS_CONFIG`).
- **Writes**: nothing.

## Privacy

- **Data collection**: none. The plugin and its authors collect no data. There is no telemetry or analytics.
- **Use and storage**: firewall responses exist only in memory to answer the current request and are passed to Claude in your conversation. API keys are stored locally, in Claude Code's secure credential store or in your `firewalls.json`.
- **Third-party sharing**: none. Requests go directly from your machine to your own firewall, or through a proxy you configured.
- **Retention**: the plugin retains nothing. Conversation data is handled by Claude under your Anthropic account's terms.
- **Contact**: [open a GitHub issue](https://github.com/apius-tech/Palo-MCP/issues) for privacy questions. Maintained by Apius Technologies SA.

Full policy: <https://github.com/apius-tech/Palo-MCP#privacy>. Security reports: <https://github.com/apius-tech/Palo-MCP#security>.

## License

MIT. See [LICENSE](LICENSE). Palo Alto Networks, PAN-OS, and Panorama are trademarks of Palo Alto Networks, Inc. This plugin is not affiliated with or endorsed by Palo Alto Networks.
