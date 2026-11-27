import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/api/client.js", () => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(async () => ({ success: true })),
  deleteConfig: vi.fn(),
  moveConfig: vi.fn(),
  formatResponse: vi.fn((r: unknown) => r),
  resolveTarget: vi.fn(() => ({ host: "fw.example.test", apiKey: "k", verifySSL: true })),
  isApiError: vi.fn(() => false),
}));

import { setConfig } from "../../src/api/client.js";
import { registerSecurityTools } from "../../src/tools/security.js";
import { registerPanoramaTools } from "../../src/tools/panorama.js";
import { registerCertificatesTools } from "../../src/tools/certificates.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;
const handlers = new Map<string, Handler>();
const fakeServer = {
  tool: (name: string, ...rest: unknown[]) => {
    handlers.set(name, rest[rest.length - 1] as Handler);
  },
};
registerSecurityTools(fakeServer as never);
registerPanoramaTools(fakeServer as never);
registerCertificatesTools(fakeServer as never);

const base = {
  name: "r1",
  from_zones: ["trust"],
  to_zones: ["untrust"],
  source: ["any"],
  destination: ["any"],
  application: ["any"],
  service: ["application-default"],
};

const cases: Array<[string, Record<string, unknown>]> = [
  ["add_security_rule", { ...base, action: "allow" }],
  ["panorama_add_pre_rule", { ...base, device_group: "dg1", action: "allow" }],
  ["panorama_add_post_rule", { ...base, device_group: "dg1", action: "allow" }],
  ["add_pbf_rule", { name: "r1", from_zones: ["trust"], source: ["any"], action: "no-pbf" }],
  ["add_qos_rule", { ...base, action_class: "1" }],
  ["add_decryption_rule", { ...base, action: "no-decrypt" }],
];

function lastElement(): string {
  const calls = vi.mocked(setConfig).mock.calls;
  return calls[calls.length - 1][1] as string;
}

describe("source_user on add-rule tools", () => {
  beforeEach(() => vi.mocked(setConfig).mockClear());

  it.each(cases)("%s emits escaped <source-user> after <source>", async (tool, args) => {
    await handlers.get(tool)!({ ...args, source_user: ["example\\jdoe", "cn=a&b,dc=example"] });
    const el = lastElement();
    expect(el).toContain(
      "<source>" + "<member>any</member>" + "</source>" +
      "<source-user><member>example\\jdoe</member><member>cn=a&amp;b,dc=example</member></source-user>",
    );
  });

  it.each(cases)("%s omits <source-user> when not provided", async (tool, args) => {
    await handlers.get(tool)!(args);
    expect(lastElement()).not.toContain("source-user");
  });
});
