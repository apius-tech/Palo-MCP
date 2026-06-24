import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { getKey, setKey, isKeychainAvailable, initKeychain } from "./keychain.js";

export interface FirewallEntry {
  name: string;
  host: string;
  api_key: string;
  verify_ssl: boolean;
}

const firewallFileEntrySchema = z.object({
  name: z.string().min(1).max(63),
  host: z.string().min(1),
  api_key: z.string().optional(),
  api_key_env: z.string().min(1).optional(),
  verify_ssl: z.boolean().optional(),
});

const firewallConfigSchema = z.object({
  firewalls: z.array(firewallFileEntrySchema).min(1),
});

function sanitizeHost(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
}

let entries: Array<{ name: string; host: string; verify_ssl: boolean }> = [];
const keyMap = new Map<string, string>();
const injectedEnvironment = new Map<string, string>();

const defaultConfigPath = join(homedir(), ".config", "panos-mcp", "firewalls.json");

export function getConfigPath(): string {
  return process.env.PANOS_FIREWALLS_CONFIG ?? defaultConfigPath;
}

export function getExpectedEnvironmentVariableNames(): Set<string> {
  const names = new Set(["PANOS_HOST", "PANOS_API_KEY", "PANOS_VERIFY_SSL"]);
  let raw: string;
  try {
    raw = readFileSync(getConfigPath(), "utf-8");
  } catch {
    return names;
  }

  const parsed = firewallConfigSchema.parse(JSON.parse(raw));
  for (const entry of parsed.firewalls) {
    if (entry.api_key_env) names.add(entry.api_key_env);
  }

  return names;
}

export function setInjectedEnvironment(env: ReadonlyMap<string, string>): void {
  injectedEnvironment.clear();
  for (const [name, value] of env) {
    injectedEnvironment.set(name, value);
  }
}

function readConfiguredEnv(name: string): string {
  const injected = injectedEnvironment.get(name);
  if (injected !== undefined) return injected.trim();
  return (process.env[name] ?? "").trim();
}

function parseBooleanEnv(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function fileEntryWithoutPlaintextKey(entry: {
  name: string;
  host: string;
  api_key_env?: string;
  verify_ssl: boolean;
}): { name: string; host: string; api_key_env?: string; verify_ssl?: boolean } {
  return {
    name: entry.name,
    host: entry.host,
    ...(entry.api_key_env ? { api_key_env: entry.api_key_env } : {}),
    ...(entry.verify_ssl ? { verify_ssl: entry.verify_ssl } : {}),
  };
}

export async function loadFirewallConfig(): Promise<void> {
  entries = [];
  keyMap.clear();

  await initKeychain();

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
    api_key_env: e.api_key_env,
    verify_ssl: e.verify_ssl ?? false,
  }));

  // Auto-migrate plaintext api_key fields to OS keychain
  if (isKeychainAvailable()) {
    const toMigrate = fileEntries.filter((e) => e.api_key);
    if (toMigrate.length > 0) {
      try {
        for (const e of toMigrate) {
          await setKey(e.name, e.api_key!);
        }
        const cleaned = { firewalls: fileEntries.map(fileEntryWithoutPlaintextKey) };
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

  entries = fileEntries.map(({ name, host, verify_ssl }) => ({ name, host, verify_ssl }));

  // Load keys into memory
  for (const e of entries) {
    const fileEntry = fileEntries.find((f) => f.name === e.name);
    if (fileEntry?.api_key_env) {
      const key = readConfiguredEnv(fileEntry.api_key_env);
      if (key) {
        keyMap.set(e.name, key);
      } else {
        process.stderr.write(
          `[panos-mcp] WARNING: Environment variable "${fileEntry.api_key_env}" for firewall "${e.name}" is not set — it will be unavailable\n`
        );
      }
      continue;
    }

    if (isKeychainAvailable()) {
      const key = (await getKey(e.name)) ?? fileEntry?.api_key ?? null;
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
  const host = sanitizeHost(readConfiguredEnv("PANOS_HOST"));
  const api_key = readConfiguredEnv("PANOS_API_KEY");
  const verify_ssl = parseBooleanEnv(readConfiguredEnv("PANOS_VERIFY_SSL")) ?? false;
  if (host && api_key) return { name: "env", host, api_key, verify_ssl };

  return null;
}

export function isMultiFirewall(): boolean {
  return entries.length > 1;
}

export function getFirewallEntries(): Array<{ name: string; host: string; verify_ssl: boolean }> {
  return entries;
}

export async function saveFirewallEntry(entry: FirewallEntry): Promise<void> {
  await initKeychain();
  entry = { ...entry, host: sanitizeHost(entry.host), verify_ssl: entry.verify_ssl ?? false };
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
  if (memIdx >= 0) entries[memIdx] = { name: entry.name, host: entry.host, verify_ssl: entry.verify_ssl };
  else entries.push({ name: entry.name, host: entry.host, verify_ssl: entry.verify_ssl });
  keyMap.set(entry.name, entry.api_key);
}
