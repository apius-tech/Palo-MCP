import { describe, it, expect, vi } from "vitest";
import { loadOnePasswordEnvironment } from "../../src/config/onepassword.js";

describe("onepassword environment loader", () => {
  it("returns an empty map when 1Password is not configured", async () => {
    const createClient = vi.fn();

    const variables = await loadOnePasswordEnvironment({
      env: {},
      createClientImpl: createClient as any,
    });

    expect(variables.size).toBe(0);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not load the SDK when 1Password is not configured", async () => {
    const loadSdk = vi.fn();

    const variables = await loadOnePasswordEnvironment({
      env: {},
      loadSdkImpl: loadSdk as any,
    });

    expect(variables.size).toBe(0);
    expect(loadSdk).not.toHaveBeenCalled();
  });

  it("treats unresolved Desktop Extension placeholders as unset", async () => {
    const loadSdk = vi.fn();

    const variables = await loadOnePasswordEnvironment({
      env: {
        OP_ENVIRONMENT_ID: "${user_config.op_environment_id}",
        OP_SERVICE_ACCOUNT_TOKEN: "${user_config.op_service_account_token}",
      },
      loadSdkImpl: loadSdk as any,
    });

    expect(variables.size).toBe(0);
    expect(loadSdk).not.toHaveBeenCalled();
  });

  it("throws when only OP_ENVIRONMENT_ID is set", async () => {
    await expect(
      loadOnePasswordEnvironment({
        env: { OP_ENVIRONMENT_ID: "env-id" },
        createClientImpl: vi.fn() as any,
      })
    ).rejects.toThrow("OP_SERVICE_ACCOUNT_TOKEN");
  });

  it("throws when only OP_SERVICE_ACCOUNT_TOKEN is set", async () => {
    await expect(
      loadOnePasswordEnvironment({
        env: { OP_SERVICE_ACCOUNT_TOKEN: "ops_token" },
        createClientImpl: vi.fn() as any,
      })
    ).rejects.toThrow("OP_ENVIRONMENT_ID");
  });

  it("loads variables from the configured 1Password Environment", async () => {
    const getVariables = vi.fn().mockResolvedValue({
      variables: [
        { name: "PANOS_HOST", value: "fw.example.com", masked: false },
        { name: "PANOS_API_KEY", value: "secret-key", masked: true },
      ],
    });
    const createClient = vi.fn().mockResolvedValue({ environments: { getVariables } });

    const variables = await loadOnePasswordEnvironment({
      env: {
        OP_ENVIRONMENT_ID: "env-id",
        OP_SERVICE_ACCOUNT_TOKEN: "ops_secret_token",
      },
      createClientImpl: createClient as any,
    });

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: "ops_secret_token",
        integrationName: "panos-mcp",
      })
    );
    expect(getVariables).toHaveBeenCalledWith("env-id");
    expect(variables).toEqual(
      new Map([
        ["PANOS_HOST", "fw.example.com"],
        ["PANOS_API_KEY", "secret-key"],
      ])
    );
  });

  it("keeps only allowed variable names when a filter is provided", async () => {
    const getVariables = vi.fn().mockResolvedValue({
      variables: [
        { name: "PANOS_API_KEY", value: "secret-key", masked: true },
        { name: "UNRELATED_SECRET", value: "do-not-retain", masked: true },
      ],
    });
    const createClient = vi.fn().mockResolvedValue({ environments: { getVariables } });

    const variables = await loadOnePasswordEnvironment({
      env: {
        OP_ENVIRONMENT_ID: "env-id",
        OP_SERVICE_ACCOUNT_TOKEN: "ops_secret_token",
      },
      allowedNames: new Set(["PANOS_API_KEY"]),
      createClientImpl: createClient as any,
    });

    expect(variables).toEqual(new Map([["PANOS_API_KEY", "secret-key"]]));
  });


  it("redacts the service account token from SDK errors", async () => {
    const createClient = vi.fn().mockRejectedValue(new Error("bad token ops_secret_token"));

    await expect(
      loadOnePasswordEnvironment({
        env: {
          OP_ENVIRONMENT_ID: "env-id",
          OP_SERVICE_ACCOUNT_TOKEN: "ops_secret_token",
        },
        createClientImpl: createClient as any,
      })
    ).rejects.toThrow("[REDACTED]");

    await expect(
      loadOnePasswordEnvironment({
        env: {
          OP_ENVIRONMENT_ID: "env-id",
          OP_SERVICE_ACCOUNT_TOKEN: "ops_secret_token",
        },
        createClientImpl: createClient as any,
      })
    ).rejects.not.toThrow("ops_secret_token");
  });
});
