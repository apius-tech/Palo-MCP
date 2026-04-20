# Keychain-Backed Credential Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store multi-firewall API keys in the OS keychain instead of plaintext in `firewalls.json`, with automatic silent migration on startup and Linux headless fallback to plaintext.

**Architecture:** A new `src/config/keychain.ts` wraps `@napi-rs/keyring`'s synchronous `Entry` class and exposes async `getKey/setKey/deleteKey/isKeychainAvailable`. `firewalls.ts` becomes async at startup — it auto-migrates any plaintext keys to the keychain, then caches all keys in an in-memory `Map<name, api_key>` so `resolveFirewall()` stays synchronous. When keychain is unavailable (Linux headless), the plaintext path is used transparently.

**Tech Stack:** `@napi-rs/keyring` v1.2.0 (sync `Entry` class), vitest (mocking via `vi.mock` + `vi.mocked`), TypeScript.

---

## File Map

| File | Change | Responsibility |
|---|---|---|
| `src/config/keychain.ts` | **Create** | Wrapper: `getKey`, `setKey`, `deleteKey`, `isKeychainAvailable`, Linux fallback |
| `src/config/firewalls.ts` | **Modify** | Async load + migration, in-memory `keyMap`, async `saveFirewallEntry` |
| `src/index.ts` | **Modify** | `await loadFirewallConfig()` in `main()` |
| `src/cli/keygen.ts` | **Modify** | Save key to keychain, write `{ name, host }` to JSON |
| `tests/config/keychain.test.ts` | **Create** | Unit tests for keychain wrapper |
| `tests/config/firewalls.test.ts` | **Modify** | Mock keychain module, update to async, add migration + fallback tests |
| `package.json` | **Modify** | Add `@napi-rs/keyring`, bump version to 1.3.16 |
| `manifest.json` | **Modify** | Bump version to 1.3.16 |

---

### Task 1: Install `@napi-rs/keyring`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install @napi-rs/keyring
```

Expected: installs without errors. A prebuilt binary for your platform is downloaded — no compilation required.

- [ ] **Step 2: Verify the types look correct**

```bash
cat node_modules/@napi-rs/keyring/index.d.ts | grep -A5 "class Entry"
```

Expected output contains:
```
class Entry {
  constructor(service: string, username: string)
  getPassword(): string | null
  setPassword(password: string): void
  deletePassword(): boolean
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @napi-rs/keyring for OS keychain support"
```

---

### Task 2: Create `src/config/keychain.ts` with tests

**Files:**
- Create: `src/config/keychain.ts`
- Create: `tests/config/keychain.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/config/keychain.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/keyring", () => ({ Entry: vi.fn() }));

import { Entry } from "@napi-rs/keyring";
import { getKey, setKey, deleteKey } from "../../src/config/keychain.js";

describe("keychain", () => {
  const mockGetPassword = vi.fn<[], string | null>(() => null);
  const mockSetPassword = vi.fn<[string], void>();
  const mockDeletePassword = vi.fn<[], boolean>(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Entry).mockImplementation(() => ({
      getPassword: mockGetPassword,
      setPassword: mockSetPassword,
      deletePassword: mockDeletePassword,
    }) as unknown as InstanceType<typeof Entry>);
  });

  it("getKey returns null when password not found", async () => {
    mockGetPassword.mockReturnValue(null);
    expect(await getKey("fw1")).toBeNull();
  });

  it("getKey returns the stored password", async () => {
    mockGetPassword.mockReturnValueOnce(null).mockReturnValue("secret-api-key");
    // first call is availability check (__availability_test__), second is actual get
    expect(await getKey("fw1")).toBe("secret-api-key");
  });

  it("setKey creates Entry with service 'panos-mcp' and account name", async () => {
    await setKey("fw1", "my-key");
    expect(vi.mocked(Entry)).toHaveBeenCalledWith("panos-mcp", "fw1");
    expect(mockSetPassword).toHaveBeenCalledWith("my-key");
  });

  it("deleteKey calls deletePassword", async () => {
    await deleteKey("fw1");
    expect(mockDeletePassword).toHaveBeenCalled();
  });

  it("deleteKey resolves without error when deletePassword throws", async () => {
    mockDeletePassword.mockImplementation(() => { throw new Error("NoEntry"); });
    await expect(deleteKey("fw1")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/config/keychain.test.ts
```

Expected: FAIL — module `../../src/config/keychain.js` does not exist.

- [ ] **Step 3: Create `src/config/keychain.ts`**

```ts
import { Entry } from "@napi-rs/keyring";

const SERVICE = "panos-mcp";
let keychainAvailable: boolean | null = null;

function checkKeychainAvailable(): boolean {
  if (keychainAvailable !== null) return keychainAvailable;
  try {
    new Entry(SERVICE, "__availability_test__").getPassword();
    keychainAvailable = true;
  } catch {
    keychainAvailable = false;
    process.stderr.write(
      "[panos-mcp] WARNING: Keychain unavailable — API keys will be stored in plaintext\n"
    );
  }
  return keychainAvailable;
}

export function isKeychainAvailable(): boolean {
  return checkKeychainAvailable();
}

export async function getKey(name: string): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  try {
    return new Entry(SERVICE, name).getPassword() ?? null;
  } catch {
    return null;
  }
}

export async function setKey(name: string, key: string): Promise<void> {
  new Entry(SERVICE, name).setPassword(key);
}

export async function deleteKey(name: string): Promise<void> {
  try {
    new Entry(SERVICE, name).deletePassword();
  } catch {
    // entry doesn't exist, ignore
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/config/keychain.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Build to catch type errors**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add src/config/keychain.ts tests/config/keychain.test.ts
git commit -m "feat: add keychain wrapper module"
```

---

### Task 3: Update `src/config/firewalls.ts`

**Files:**
- Modify: `src/config/firewalls.ts`

This task makes `loadFirewallConfig()` and `saveFirewallEntry()` async, replaces the `entries` state with a `keyMap`, and adds migration + fallback logic. Make all changes to `firewalls.ts` in one step, then run the existing tests (which will fail until Task 4 updates them).

- [ ] **Step 1: Replace `src/config/firewalls.ts` with the updated version**

Replace the entire file with:

```ts
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { getKey, setKey, isKeychainAvailable } from "./keychain.js";

export interface FirewallEntry {
  name: string;
  host: string;
  api_key: string;
}

const firewallFileEntrySchema = z.object({
  name: z.string().min(1).max(63),
  host: z.string().min(1),
  api_key: z.string().optional(),
});

const firewallConfigSchema = z.object({
  firewalls: z.array(firewallFileEntrySchema).min(1),
});

function sanitizeHost(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
}

let entries: Array<{ name: string; host: string }> = [];
const keyMap = new Map<string, string>();

const defaultConfigPath = join(homedir(), ".config", "panos-mcp", "firewalls.json");

export function getConfigPath(): string {
  return process.env.PANOS_FIREWALLS_CONFIG ?? defaultConfigPath;
}

export async function loadFirewallConfig(): Promise<void> {
  entries = [];
  keyMap.clear();

  const configPath = getConfigPath();

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    return;
  }

  const parsed = firewallConfigSchema.parse(JSON.parse(raw));
  const fileEntries = parsed.firewalls.map((e) => ({
    name: e.name,
    host: sanitizeHost(e.host),
    api_key: e.api_key,
  }));

  // Auto-migrate plaintext api_key fields to OS keychain
  if (isKeychainAvailable()) {
    const toMigrate = fileEntries.filter((e) => e.api_key);
    if (toMigrate.length > 0) {
      try {
        for (const e of toMigrate) {
          await setKey(e.name, e.api_key!);
        }
        const cleaned = { firewalls: fileEntries.map(({ name, host }) => ({ name, host })) };
        writeFileSync(configPath, JSON.stringify(cleaned, null, 2) + "\n");
        process.stderr.write(
          `[panos-mcp] Migrated ${toMigrate.length} API key(s) to system keychain\n`
        );
      } catch (err) {
        process.stderr.write(
          `[panos-mcp] ERROR: Migration failed — ${String(err)}. Keys remain in plaintext.\n`
        );
      }
    }
  }

  entries = fileEntries.map(({ name, host }) => ({ name, host }));

  // Load keys into memory
  for (const e of entries) {
    if (isKeychainAvailable()) {
      const key = await getKey(e.name);
      if (key) {
        keyMap.set(e.name, key);
      } else {
        process.stderr.write(
          `[panos-mcp] WARNING: No keychain entry for firewall "${e.name}" — it will be unavailable\n`
        );
      }
    } else {
      // Fallback: read api_key directly from file entry
      const fileEntry = fileEntries.find((f) => f.name === e.name);
      if (fileEntry?.api_key) keyMap.set(e.name, fileEntry.api_key);
    }
  }
}

export function resolveFirewall(name?: string): FirewallEntry | null {
  if (name) {
    const e = entries.find((e) => e.name === name);
    if (!e) return null;
    const key = keyMap.get(e.name);
    if (!key) return null;
    return { ...e, api_key: key };
  }

  if (entries.length === 1) {
    const e = entries[0];
    const key = keyMap.get(e.name);
    if (!key) return null;
    return { ...e, api_key: key };
  }

  if (entries.length > 1) return null;

  // No config entries — fall back to env vars
  const host = sanitizeHost(process.env.PANOS_HOST ?? "");
  const api_key = (process.env.PANOS_API_KEY ?? "").trim();
  if (host && api_key) return { name: "env", host, api_key };

  return null;
}

export function isMultiFirewall(): boolean {
  return entries.length > 1;
}

export function getFirewallEntries(): Array<{ name: string; host: string }> {
  return entries;
}

export async function saveFirewallEntry(entry: FirewallEntry): Promise<void> {
  entry = { ...entry, host: sanitizeHost(entry.host) };
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });

  let config: { firewalls: Array<{ name: string; host: string; api_key?: string }> };
  try {
    const raw = readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
    if (!Array.isArray(config.firewalls)) config = { firewalls: [] };
  } catch {
    config = { firewalls: [] };
  }

  if (isKeychainAvailable()) {
    await setKey(entry.name, entry.api_key);
    const fileEntry = { name: entry.name, host: entry.host };
    const idx = config.firewalls.findIndex((e) => e.name === entry.name);
    if (idx >= 0) config.firewalls[idx] = fileEntry;
    else config.firewalls.push(fileEntry);
  } else {
    const idx = config.firewalls.findIndex((e) => e.name === entry.name);
    if (idx >= 0) config.firewalls[idx] = { name: entry.name, host: entry.host, api_key: entry.api_key };
    else config.firewalls.push({ name: entry.name, host: entry.host, api_key: entry.api_key });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  // Update in-memory state directly (avoids re-reading file and keychain)
  const memIdx = entries.findIndex((e) => e.name === entry.name);
  if (memIdx >= 0) entries[memIdx] = { name: entry.name, host: entry.host };
  else entries.push({ name: entry.name, host: entry.host });
  keyMap.set(entry.name, entry.api_key);
}
```

- [ ] **Step 2: Build to catch type errors**

```bash
npm run build
```

Expected: compiles without errors. The existing tests will now fail because `loadFirewallConfig()` is async — that's expected and fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/config/firewalls.ts
git commit -m "feat: make firewalls config async, add keychain migration and fallback"
```

---

### Task 4: Update `tests/config/firewalls.test.ts`

**Files:**
- Modify: `tests/config/firewalls.test.ts`

The existing test file needs: (1) a `vi.mock` for the keychain module, (2) all `loadFirewallConfig()` calls awaited, (3) all `saveFirewallEntry()` calls awaited, (4) updated JSON assertions (no more `api_key` in file when keychain available), (5) new migration and fallback tests.

- [ ] **Step 1: Run existing tests to see them fail**

```bash
npm test -- tests/config/firewalls.test.ts
```

Expected: multiple FAIL — async functions called without await, keychain module not mocked.

- [ ] **Step 2: Replace `tests/config/firewalls.test.ts` with the updated version**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

vi.mock("../../src/config/keychain.js", () => ({
  getKey: vi.fn(),
  setKey: vi.fn(),
  deleteKey: vi.fn(),
  isKeychainAvailable: vi.fn(),
}));

import { getKey, setKey, isKeychainAvailable } from "../../src/config/keychain.js";
import {
  loadFirewallConfig,
  resolveFirewall,
  isMultiFirewall,
  getFirewallEntries,
  saveFirewallEntry,
} from "../../src/config/firewalls.js";

const tmpConfig = resolve("firewalls.test.tmp.json");

function writeConfig(data: unknown) {
  writeFileSync(tmpConfig, JSON.stringify(data));
}

function cleanup() {
  try { unlinkSync(tmpConfig); } catch {}
}

describe("firewalls config", () => {
  let keychainStore: Map<string, string>;

  beforeEach(() => {
    cleanup();
    keychainStore = new Map();
    vi.mocked(isKeychainAvailable).mockReturnValue(true);
    vi.mocked(getKey).mockImplementation(async (name) => keychainStore.get(name) ?? null);
    vi.mocked(setKey).mockImplementation(async (name, key) => void keychainStore.set(name, key));
    delete process.env.PANOS_FIREWALLS_CONFIG;
    delete process.env.PANOS_HOST;
    delete process.env.PANOS_API_KEY;
  });

  describe("no config file — env var fallback", () => {
    beforeEach(async () => {
      process.env.PANOS_FIREWALLS_CONFIG = tmpConfig;
      await loadFirewallConfig();
    });

    it("resolves to null when no env vars set", () => {
      expect(resolveFirewall()).toBeNull();
    });

    it("resolves to env entry when env vars are set", () => {
      process.env.PANOS_HOST = "10.0.0.1";
      process.env.PANOS_API_KEY = "key123";
      expect(resolveFirewall()).toEqual({ name: "env", host: "10.0.0.1", api_key: "key123" });
    });

    it("isMultiFirewall returns false", () => {
      expect(isMultiFirewall()).toBe(false);
    });

    it("getFirewallEntries returns empty array", () => {
      expect(getFirewallEntries()).toEqual([]);
    });
  });

  describe("single entry config (keychain mode)", () => {
    beforeEach(async () => {
      process.env.PANOS_FIREWALLS_CONFIG = tmpConfig;
      keychainStore.set("fw1", "key1");
      writeConfig({ firewalls: [{ name: "fw1", host: "10.0.1.1" }] });
      await loadFirewallConfig();
    });

    it("resolves without name (defaults to single entry)", () => {
      expect(resolveFirewall()).toEqual({ name: "fw1", host: "10.0.1.1", api_key: "key1" });
    });

    it("resolves by name", () => {
      expect(resolveFirewall("fw1")).toEqual({ name: "fw1", host: "10.0.1.1", api_key: "key1" });
    });

    it("returns null for unknown name", () => {
      expect(resolveFirewall("unknown")).toBeNull();
    });

    it("isMultiFirewall returns false", () => {
      expect(isMultiFirewall()).toBe(false);
    });
  });

  describe("multi entry config", () => {
    beforeEach(async () => {
      process.env.PANOS_FIREWALLS_CONFIG = tmpConfig;
      keychainStore.set("fw1", "key1");
      keychainStore.set("fw2", "key2");
      writeConfig({
        firewalls: [
          { name: "fw1", host: "10.0.1.1" },
          { name: "fw2", host: "10.0.2.2" },
        ],
      });
      await loadFirewallConfig();
    });

    it("returns null without name (multi requires explicit)", () => {
      expect(resolveFirewall()).toBeNull();
    });

    it("resolves by name", () => {
      expect(resolveFirewall("fw2")).toEqual({ name: "fw2", host: "10.0.2.2", api_key: "key2" });
    });

    it("returns null for unknown name", () => {
      expect(resolveFirewall("fw3")).toBeNull();
    });

    it("isMultiFirewall returns true", () => {
      expect(isMultiFirewall()).toBe(true);
    });

    it("getFirewallEntries returns all entries", () => {
      expect(getFirewallEntries()).toHaveLength(2);
    });
  });

  describe("migration — plaintext api_key in JSON", () => {
    beforeEach(() => {
      process.env.PANOS_FIREWALLS_CONFIG = tmpConfig;
    });

    it("calls setKey for each entry with api_key and rewrites JSON without keys", async () => {
      writeConfig({
        firewalls: [
          { name: "fw1", host: "10.0.1.1", api_key: "key1" },
          { name: "fw2", host: "10.0.2.2", api_key: "key2" },
        ],
      });

      await loadFirewallConfig();

      expect(vi.mocked(setKey)).toHaveBeenCalledWith("fw1", "key1");
      expect(vi.mocked(setKey)).toHaveBeenCalledWith("fw2", "key2");

      const data = JSON.parse(readFileSync(tmpConfig, "utf-8"));
      expect(data.firewalls[0]).not.toHaveProperty("api_key");
      expect(data.firewalls[1]).not.toHaveProperty("api_key");
    });

    it("resolves entries correctly after migration", async () => {
      writeConfig({
        firewalls: [{ name: "fw1", host: "10.0.1.1", api_key: "migrated-key" }],
      });

      await loadFirewallConfig();

      expect(resolveFirewall("fw1")).toEqual({
        name: "fw1",
        host: "10.0.1.1",
        api_key: "migrated-key",
      });
    });

    it("does not migrate when keychain unavailable", async () => {
      vi.mocked(isKeychainAvailable).mockReturnValue(false);
      writeConfig({
        firewalls: [{ name: "fw1", host: "10.0.1.1", api_key: "key1" }],
      });

      await loadFirewallConfig();

      expect(vi.mocked(setKey)).not.toHaveBeenCalled();
      const data = JSON.parse(readFileSync(tmpConfig, "utf-8"));
      expect(data.firewalls[0].api_key).toBe("key1");
    });
  });

  describe("Linux headless fallback (keychain unavailable)", () => {
    beforeEach(() => {
      vi.mocked(isKeychainAvailable).mockReturnValue(false);
      process.env.PANOS_FIREWALLS_CONFIG = tmpConfig;
    });

    it("reads api_key from JSON when keychain unavailable", async () => {
      writeConfig({
        firewalls: [{ name: "fw1", host: "10.0.1.1", api_key: "plaintext-key" }],
      });

      await loadFirewallConfig();

      expect(resolveFirewall("fw1")).toEqual({
        name: "fw1",
        host: "10.0.1.1",
        api_key: "plaintext-key",
      });
    });

    it("returns null when api_key absent from JSON in fallback mode", async () => {
      writeConfig({ firewalls: [{ name: "fw1", host: "10.0.1.1" }] });

      await loadFirewallConfig();

      expect(resolveFirewall("fw1")).toBeNull();
    });
  });

  describe("saveFirewallEntry", () => {
    beforeEach(async () => {
      process.env.PANOS_FIREWALLS_CONFIG = tmpConfig;
      cleanup();
    });

    it("saves api_key to keychain and writes host-only entry to JSON", async () => {
      await saveFirewallEntry({ name: "new-fw", host: "10.0.3.1", api_key: "key3" });

      expect(vi.mocked(setKey)).toHaveBeenCalledWith("new-fw", "key3");
      const data = JSON.parse(readFileSync(tmpConfig, "utf-8"));
      expect(data.firewalls[0]).toEqual({ name: "new-fw", host: "10.0.3.1" });
      expect(data.firewalls[0]).not.toHaveProperty("api_key");
    });

    it("writes api_key to JSON when keychain unavailable", async () => {
      vi.mocked(isKeychainAvailable).mockReturnValue(false);

      await saveFirewallEntry({ name: "new-fw", host: "10.0.3.1", api_key: "key3" });

      expect(vi.mocked(setKey)).not.toHaveBeenCalled();
      const data = JSON.parse(readFileSync(tmpConfig, "utf-8"));
      expect(data.firewalls[0].api_key).toBe("key3");
    });

    it("appends to existing firewalls.json", async () => {
      writeConfig({ firewalls: [{ name: "fw1", host: "10.0.1.1" }] });

      await saveFirewallEntry({ name: "fw2", host: "10.0.2.2", api_key: "key2" });

      const data = JSON.parse(readFileSync(tmpConfig, "utf-8"));
      expect(data.firewalls).toHaveLength(2);
      expect(data.firewalls[1].name).toBe("fw2");
    });

    it("updates existing entry by name", async () => {
      writeConfig({ firewalls: [{ name: "fw1", host: "10.0.1.1" }] });

      await saveFirewallEntry({ name: "fw1", host: "10.0.1.1", api_key: "new-key" });

      expect(vi.mocked(setKey)).toHaveBeenCalledWith("fw1", "new-key");
      const data = JSON.parse(readFileSync(tmpConfig, "utf-8"));
      expect(data.firewalls).toHaveLength(1);
    });

    it("updates in-memory entries and keyMap after save", async () => {
      await loadFirewallConfig();
      expect(getFirewallEntries()).toHaveLength(0);

      await saveFirewallEntry({ name: "fw1", host: "10.0.1.1", api_key: "key1" });

      expect(getFirewallEntries()).toHaveLength(1);
      expect(getFirewallEntries()[0].name).toBe("fw1");
      expect(resolveFirewall("fw1")).toEqual({ name: "fw1", host: "10.0.1.1", api_key: "key1" });
    });
  });
});
```

- [ ] **Step 3: Run tests to confirm they pass**

```bash
npm test -- tests/config/firewalls.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/config/firewalls.test.ts
git commit -m "test: update firewalls tests for async keychain-backed config"
```

---

### Task 5: Update `src/index.ts`

**Files:**
- Modify: `src/index.ts`

`loadFirewallConfig()` is now async. The call in `main()` must be awaited.

- [ ] **Step 1: Move `loadFirewallConfig()` call inside `main()` and await it**

In `src/index.ts`, remove the top-level `loadFirewallConfig()` call (line 24) and add `await loadFirewallConfig()` at the start of `main()`:

```ts
async function main() {
  await loadFirewallConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

The full updated `src/index.ts`:

```ts
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
  version: "1.3.16",
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
```

- [ ] **Step 2: Build to confirm no type errors**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: await loadFirewallConfig() in main()"
```

---

### Task 6: Update `src/cli/keygen.ts`

**Files:**
- Modify: `src/cli/keygen.ts`

After generating a key, save it to keychain (via `saveFirewallEntry` which already handles keychain/fallback logic). No changes to the CLI interface — `--host`, `--user`, `--name` work identically.

- [ ] **Step 1: Update the save block in `main()` inside `keygen.ts`**

Replace the block starting at line 81 (`if (args.name) {`):

```ts
  if (args.name) {
    await saveFirewallEntry({ name: args.name, host: args.host, api_key: key });
    if (isKeychainAvailable()) {
      console.error(`Saved "${args.name}" — host in firewalls.json, key in system keychain`);
    } else {
      console.error(`Saved "${args.name}" in firewalls.json (WARNING: API key stored in plaintext)`);
    }
  }
```

And update the import at the top of the file — add `saveFirewallEntry` is already imported, but `saveFirewallEntry` is now async, so just ensure the call is awaited (it already is in the block above).

The full updated `src/cli/keygen.ts`:

```ts
#!/usr/bin/env node

import { createInterface } from "readline";
import { generateApiKey } from "../api/client.js";
import { saveFirewallEntry } from "../config/firewalls.js";
import { isKeychainAvailable } from "../config/keychain.js";

function parseArgs(argv: string[]): { host?: string; user?: string; name?: string } {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--host" && argv[i + 1]) args.host = argv[++i];
    else if (arg === "--user" && argv[i + 1]) args.user = argv[++i];
    else if (arg === "--name" && argv[i + 1]) args.name = argv[++i];
  }
  return args;
}

function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });

    if (process.stdin.isTTY) {
      process.stderr.write(prompt);
      process.stdin.setRawMode(true);
      let password = "";
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r") {
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onData);
          process.stderr.write("\n");
          rl.close();
          resolve(password);
        } else if (c === "\u0003") {
          process.stderr.write("\n");
          process.exit(1);
        } else if (c === "\u007f" || c === "\b") {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stderr.write("\b \b");
          }
        } else {
          password += c;
          process.stderr.write("*");
        }
      };
      process.stdin.on("data", onData);
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.host || !args.user) {
    console.error("Usage: panos-keygen --host <hostname> --user <username> [--name <save-name>]");
    process.exit(1);
  }

  const password = await readPassword("Password: ");
  if (!password) {
    console.error("Error: password is required");
    process.exit(1);
  }

  const result = await generateApiKey(args.host, args.user, password);

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  const key = result.data.key;
  console.log(key);

  if (args.name) {
    await saveFirewallEntry({ name: args.name, host: args.host, api_key: key });
    if (isKeychainAvailable()) {
      console.error(`Saved "${args.name}" — host in firewalls.json, key in system keychain`);
    } else {
      console.error(`Saved "${args.name}" in firewalls.json (WARNING: API key stored in plaintext)`);
    }
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Build to confirm no type errors**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/cli/keygen.ts
git commit -m "feat: save API key to keychain in panos-keygen CLI"
```

---

### Task 7: Bump version to 1.3.16 and create release

**Files:**
- Modify: `package.json`
- Modify: `manifest.json`
- Modify: `src/index.ts` (already updated in Task 5)

Note: `src/index.ts` already has version `1.3.16` from Task 5.

- [ ] **Step 1: Bump version in `package.json`**

Change line 3:
```json
"version": "1.3.15",
```
to:
```json
"version": "1.3.16",
```

- [ ] **Step 2: Bump version in `manifest.json`**

Change the `"version"` field from `"1.3.15"` to `"1.3.16"`.

- [ ] **Step 3: Build, bundle, and pack the extension**

```bash
npm run pack:extension
```

Expected: creates `panos-mcp.mcpb` without errors.

- [ ] **Step 4: Commit**

```bash
git add package.json manifest.json
git commit -m "chore: bump version to 1.3.16 — keychain-backed credential storage"
```

- [ ] **Step 5: Push and create GitHub release**

```bash
git push
gh release create v1.3.16 panos-mcp.mcpb \
  --title "v1.3.16 — Keychain-backed credential storage" \
  --notes "Closes #5. API keys for multi-firewall mode are now stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret) instead of plaintext in firewalls.json. Existing plaintext keys are automatically migrated to the keychain on first startup. Linux headless environments without a secret service fall back to plaintext with a warning."
```

Expected: release created with `panos-mcp.mcpb` attached.
