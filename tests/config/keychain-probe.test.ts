import { describe, it, expect, vi, beforeEach } from "vitest";

// keyring >= 2.0 throws on store errors (locked keychain, denied access) instead of
// returning null. Those must not flip the keychain to "unavailable", or keys would be
// written to firewalls.json in plaintext.
describe("keychain probe", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("stays available when the probe read throws", async () => {
    vi.doMock("@napi-rs/keyring", () => ({
      Entry: vi.fn(function () {
        return {
          getPassword: () => { throw new Error("keychain locked"); },
          setPassword: vi.fn(),
          deletePassword: () => false,
        };
      }),
    }));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { initKeychain, isKeychainAvailable, getKey } = await import("../../src/config/keychain.js");

    await initKeychain();
    expect(isKeychainAvailable()).toBe(true);
    expect(await getKey("fw1")).toBeNull();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("keychain locked"));
    stderr.mockRestore();
  });

  it("is unavailable when the native module cannot load", async () => {
    vi.doMock("@napi-rs/keyring", () => { throw new Error("no native binding"); });
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { initKeychain, isKeychainAvailable } = await import("../../src/config/keychain.js");

    await initKeychain();
    expect(isKeychainAvailable()).toBe(false);
    stderr.mockRestore();
  });
});
