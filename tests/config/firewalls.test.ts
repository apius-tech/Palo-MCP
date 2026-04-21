import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

vi.mock("../../src/config/keychain.js", () => ({
  getKey: vi.fn(),
  setKey: vi.fn(),
  deleteKey: vi.fn(),
  isKeychainAvailable: vi.fn(),
  initKeychain: vi.fn().mockResolvedValue(undefined),
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
    vi.clearAllMocks();
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
