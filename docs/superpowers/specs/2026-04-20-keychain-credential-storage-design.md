# Keychain-Backed Credential Storage for Multi-Firewall Config

**Date:** 2026-04-20
**Issue:** [#5](https://github.com/apius-tech/Palo-MCP/issues/5)
**Status:** Approved

## Problem

`firewalls.json` stores API keys as plaintext on disk. The single-firewall Desktop Extension path already uses the OS keychain via Claude Desktop (`user_config` with `"sensitive": true`). Users in multi-firewall mode have no equivalent protection.

## Goals

- API keys stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret)
- `firewalls.json` holds only `{ name, host }` entries
- Automatic, silent migration of existing plaintext keys on first startup
- Linux headless fallback to plaintext with warning (no crash)
- No changes to user-facing CLI interface

## Non-Goals

- Changing the Desktop Extension single-firewall flow (already keychain-backed)
- Supporting cloud secret stores (Vault, AWS Secrets Manager, etc.)
- Interactive migration wizard

## Library

**`@napi-rs/keyring`** — actively maintained, prebuilt napi-rs binaries (no compilation required on `npx`), clean TypeScript API, cross-platform.

Keychain coordinates: `service = "panos-mcp"`, `account = <firewall name>`.

## Architecture

### New file: `src/config/keychain.ts`

Thin wrapper around `@napi-rs/keyring`. Exports:

```ts
getKey(name: string): Promise<string | null>
setKey(name: string, key: string): Promise<void>
deleteKey(name: string): Promise<void>
isKeychainAvailable(): boolean
```

On first call, attempts a test operation. If `@napi-rs/keyring` throws (Linux without secret service), sets `keychainAvailable = false` and logs a warning to stderr. All subsequent calls short-circuit with the fallback behavior.

### Modified: `src/config/firewalls.ts`

**Schema change:** `api_key` becomes optional in the Zod file schema (present only during migration or plaintext fallback).

**In-memory key map:** `const keyMap = new Map<string, string>()` — populated at startup from keychain. Keeps `resolveFirewall()` synchronous (no changes to callers).

**`loadFirewallConfig()` → async:**
1. Read `firewalls.json`
2. If any entry has `api_key` and keychain is available → migrate (see below)
3. For each entry, load key from keychain into `keyMap`
4. If keychain unavailable → load `api_key` from JSON into `keyMap` (fallback)

**`resolveFirewall(name?)`** — unchanged signature, reads key from `keyMap`.

**`saveFirewallEntry(entry)` → async:**
- If keychain available: save `api_key` to keychain, write `{ name, host }` to JSON
- If keychain unavailable: write `{ name, host, api_key }` to JSON (existing behavior)

### Modified: `src/cli/keygen.ts`

After `generateApiKey()` succeeds:
1. Call `setKey(name, api_key)` if keychain available
2. Call `saveFirewallEntry({ name, host })` — no `api_key` in JSON
3. Log: `Saved "${name}" — host in firewalls.json, key in system keychain`

If keychain unavailable: existing behavior, plus warning.

### Modified: `src/index.ts`

`loadFirewallConfig()` becomes async → `await loadFirewallConfig()` in `main()`.

### Modified: `package.json`

Add `@napi-rs/keyring` to `dependencies`.

## Migration

Triggered automatically at startup when `api_key` fields are detected in `firewalls.json`:

1. For each entry with `api_key`: call `setKey(name, api_key)`
2. Rewrite `firewalls.json` stripping all `api_key` fields
3. Log to stderr: `[panos-mcp] Migrated N API key(s) to system keychain`

**Idempotent:** subsequent startups find no `api_key` fields → no action.

**Rollback:** if keychain write fails mid-migration, abort rewrite and log error — original JSON unchanged.

## Linux Headless Fallback

If `@napi-rs/keyring` is unavailable (no `libsecret`/`gnome-keyring` daemon):

- `isKeychainAvailable()` returns `false`
- Warning logged: `[panos-mcp] WARNING: Keychain unavailable — API keys stored in plaintext`
- Migration skipped
- Keys read/written from `api_key` field in JSON (existing behavior)
- `saveFirewallEntry()` includes `api_key` in JSON

## Data Flow

```
Startup:
  firewalls.json
    → detect api_key fields → migrate to keychain → rewrite JSON
    → load entries
    → for each entry: fetch key from keychain → keyMap
    → server ready

Tool call:
  resolveFirewall(name) → keyMap.get(name) → FirewallEntry { name, host, api_key }

panos-keygen:
  generateApiKey(host, user, password)
    → setKey(name, key) [keychain]
    → saveFirewallEntry({ name, host }) [JSON, no api_key]
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Keychain unavailable at startup | Warning + plaintext fallback |
| Keychain read fails for specific entry | Log error, entry resolves to null (tool returns error to LLM) |
| Migration write fails mid-way | Abort rewrite, log error, leave original JSON intact |
| Entry in JSON but no key in keychain | Attempt keychain read returns null → tool returns actionable error |

## Files Changed

| File | Change |
|---|---|
| `src/config/keychain.ts` | **New** — keychain wrapper |
| `src/config/firewalls.ts` | Async load, keyMap, migration, fallback |
| `src/cli/keygen.ts` | Save key to keychain instead of JSON |
| `src/index.ts` | `await loadFirewallConfig()` |
| `package.json` | Add `@napi-rs/keyring` dependency |
