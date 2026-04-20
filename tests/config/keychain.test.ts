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
    vi.mocked(Entry).mockImplementation(function () {
      return {
        getPassword: mockGetPassword,
        setPassword: mockSetPassword,
        deletePassword: mockDeletePassword,
      } as unknown as InstanceType<typeof Entry>;
    });
  });

  it("getKey returns null when password not found", async () => {
    mockGetPassword.mockReturnValue(null);
    expect(await getKey("fw1")).toBeNull();
  });

  it("getKey returns the stored password", async () => {
    // keychainAvailable is already cached as true from test 1, so no availability re-check
    mockGetPassword.mockReturnValue("secret-api-key");
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
