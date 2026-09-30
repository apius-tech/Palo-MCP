import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockAgent } from "undici";

vi.mock("../../src/config/firewalls.js", () => ({
  resolveFirewall: vi.fn(),
  isMultiFirewall: vi.fn(),
}));

vi.mock("../../src/api/proxy.js", () => ({
  buildDispatcher: vi.fn(),
  describeProxy: vi.fn(),
}));

import { resolveFirewall, isMultiFirewall } from "../../src/config/firewalls.js";
import { buildDispatcher, describeProxy } from "../../src/api/proxy.js";
import {
  commitAll,
  commitConfig,
  deleteConfig,
  executeLogQuery,
  executeOpCommand,
  generateApiKey,
  getConfig,
  moveConfig,
  resolveTarget,
  setConfig,
  type ApiResponse,
  type FirewallTarget,
} from "../../src/api/client.js";

const target: FirewallTarget = {
  host: "firewall.example.test",
  apiKey: "test-api-key",
  verifySSL: true,
};
const origin = `https://${target.host}`;
const cmd = "<show><session><all><filter>VPN + guest &amp; staff</filter></all></session></show>";
const xpath = "/config/shared/address/entry[@name='office & lab']";
const element = '<entry name="office &amp; lab"><description>VPN + guest</description></entry>';
const apiErrorXml = '<response status="error" code="7"><msg><line>Invalid XPath</line></msg></response>';
const apiError = { success: false, error: 'PanOS API Error: {"line":"Invalid XPath"}' };
const noTargetError = {
  success: false,
  error: "No firewall configured. Set PANOS_HOST/PANOS_API_KEY environment variables or provide a firewalls.json config file.",
};

function successXml(result: string) {
  return `<response status="success"><result>${result}</result></response>`;
}

let agent: MockAgent;

// Match the full query and API-key header, and reject every unmatched request.
// Only config/proxy selection is stubbed; Undici fetch and XML parsing stay real.
function intercept(query: Record<string, string>, apiKey: string | null = target.apiKey) {
  return agent.get(origin).intercept({
    path: "/api/",
    method: "GET",
    query,
    headers: (headers) => headers["x-pan-key"] === (apiKey ?? undefined),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  agent = new MockAgent();
  agent.disableNetConnect();
  vi.mocked(buildDispatcher).mockReturnValue(agent);
  vi.mocked(describeProxy).mockReturnValue(null);
  vi.mocked(isMultiFirewall).mockReturnValue(false);
  vi.mocked(resolveFirewall).mockReturnValue(null);
});

afterEach(async () => {
  vi.useRealTimers();
  try {
    agent.assertNoPendingInterceptors();
  } finally {
    await agent.close();
  }
});

describe("resolveTarget", () => {
  it("requires a name when multiple firewalls are configured", () => {
    vi.mocked(isMultiFirewall).mockReturnValue(true);

    expect(resolveTarget()).toEqual({
      success: false,
      error: "Multiple firewalls configured. The 'firewall' parameter is required — use list_firewalls to see available names.",
    });
    expect(resolveFirewall).not.toHaveBeenCalled();
  });

  it("resolves a named firewall with its own API key and TLS setting", () => {
    vi.mocked(isMultiFirewall).mockReturnValue(true);
    vi.mocked(resolveFirewall).mockReturnValue({
      name: "branch",
      host: target.host,
      api_key: target.apiKey,
      verify_ssl: true,
    });

    expect(resolveTarget("branch")).toEqual(target);
    expect(resolveFirewall).toHaveBeenCalledWith("branch");
  });

  it("resolves a single firewall without a name", () => {
    vi.mocked(resolveFirewall).mockReturnValue({
      name: "lab",
      host: target.host,
      api_key: target.apiKey,
      verify_ssl: false,
    });

    expect(resolveTarget()).toEqual({ ...target, verifySSL: false });
  });

  it("reports an unknown firewall name", () => {
    expect(resolveTarget("missing")).toEqual({
      success: false,
      error: "Firewall 'missing' not found. Use list_firewalls to see available names.",
    });
  });

  it("reports missing configuration", () => {
    expect(resolveTarget()).toEqual(noTargetError);
  });
});

const requests: Array<{
  name: string;
  query: Record<string, string>;
  call: (target?: FirewallTarget) => Promise<ApiResponse>;
}> = [
  {
    name: "executeOpCommand",
    query: { type: "op", cmd },
    call: (t) => executeOpCommand(cmd, t),
  },
  {
    name: "getConfig",
    query: { type: "config", action: "get", xpath },
    call: (t) => getConfig(xpath, t),
  },
  {
    name: "setConfig",
    query: { type: "config", action: "set", xpath, element },
    call: (t) => setConfig(xpath, element, t),
  },
  {
    name: "deleteConfig",
    query: { type: "config", action: "delete", xpath },
    call: (t) => deleteConfig(xpath, t),
  },
  {
    name: "moveConfig before a named rule",
    query: { type: "config", action: "move", xpath, where: "before", dst: "Allow & inspect + VPN" },
    call: (t) => moveConfig(xpath, "before", "Allow & inspect + VPN", t),
  },
  {
    name: "moveConfig to the top",
    query: { type: "config", action: "move", xpath, where: "top" },
    call: (t) => moveConfig(xpath, "top", undefined, t),
  },
  {
    name: "commitConfig",
    query: { type: "commit", cmd },
    call: (t) => commitConfig(cmd, t),
  },
  {
    name: "commitAll",
    query: { type: "commit", action: "all", cmd },
    call: (t) => commitAll(cmd, t),
  },
];

describe("API requests", () => {
  it.each(requests)("$name sends encoded parameters and authenticates with X-PAN-KEY", async ({ query, call }) => {
    intercept(query).reply(200, successXml("<message>accepted</message>"));

    expect(await call(target)).toEqual({ success: true, data: { message: "accepted" } });
    expect(resolveFirewall).not.toHaveBeenCalled();
    expect(buildDispatcher).toHaveBeenCalledOnce();
    const [url, verifySSL] = vi.mocked(buildDispatcher).mock.calls[0];
    expect(new URL(url).origin).toBe(origin);
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual(query);
    expect(verifySSL).toBe(true);
  });

  it.each(requests)("$name uses the configured target when none is supplied", async ({ query, call }) => {
    vi.mocked(resolveFirewall).mockReturnValue({
      name: "lab",
      host: target.host,
      api_key: target.apiKey,
      verify_ssl: false,
    });
    intercept(query).reply(200, '<response status="success"/>');

    expect(await call()).toEqual({ success: true, data: "OK" });
    expect(resolveFirewall).toHaveBeenCalledWith(undefined);
    expect(buildDispatcher).toHaveBeenCalledWith(expect.any(String), false);
  });

  it.each(requests)("$name stops before dispatch when no target is configured", async ({ call }) => {
    expect(await call()).toEqual(noTargetError);
    expect(buildDispatcher).not.toHaveBeenCalled();
  });

  it("generates an API key with encoded credentials and no existing API-key header", async () => {
    intercept({ type: "keygen", user: "lab admin+test", password: "p&ss=word+#%" }, null)
      .reply(200, successXml("<key>generated-key</key>"));

    expect(await generateApiKey(target.host, "lab admin+test", "p&ss=word+#%")).toEqual({
      success: true,
      data: { key: "generated-key" },
    });
    expect(buildDispatcher).toHaveBeenCalledWith(expect.any(String), false);
  });
});

describe("API responses", () => {
  const query = { type: "op", cmd };

  it("parses XML result data including attributes and repeated entries", async () => {
    intercept(query).reply(200, successXml('<entry name="first"><count>2</count></entry><entry name="second"><count>3</count></entry>'));

    expect(await executeOpCommand(cmd, target)).toEqual({
      success: true,
      data: { entry: [{ "@_name": "first", count: 2 }, { "@_name": "second", count: 3 }] },
    });
  });

  it("returns success messages when the response has no result", async () => {
    intercept(query).reply(200, '<response status="success"><msg>Command succeeded</msg></response>');

    expect(await executeOpCommand(cmd, target)).toEqual({ success: true, data: "Command succeeded" });
  });

  it("reports HTTP errors without treating their body as a successful response", async () => {
    intercept(query).reply(403, successXml("<message>not authorized</message>"));

    expect(await executeOpCommand(cmd, target)).toEqual({ success: false, error: "HTTP 403 Forbidden" });
  });

  it("reports PAN-OS errors returned with HTTP 200", async () => {
    intercept(query).reply(200, apiErrorXml);

    expect(await executeOpCommand(cmd, target)).toEqual(apiError);
  });

  it("reports XML parsing errors", async () => {
    intercept(query).reply(200, '<response status="success"><result><![CDATA[unterminated');

    expect(await executeOpCommand(cmd, target)).toEqual({
      success: false,
      error: expect.stringContaining("Failed to parse XML response:"),
    });
  });

  it("includes the connection cause and proxy context in transport errors", async () => {
    vi.mocked(describeProxy).mockReturnValue("http://user:***@proxy.example.test:3128 (from HTTPS_PROXY)");
    intercept(query).replyWithError(new Error("connection refused"));

    expect(await executeOpCommand(cmd, target)).toEqual({
      success: false,
      error: "Error connecting to firewall: fetch failed (connection refused) [via http://user:***@proxy.example.test:3128 (from HTTPS_PROXY)]",
    });
  });
});

describe("log queries", () => {
  const query = "( addr.src in 10.0.0.0/8 ) and ( app eq 'ssl' )";
  const submit = { type: "log", "log-type": "traffic", nlogs: "20", query };
  const poll = { type: "log", action: "get", "job-id": "42" };

  beforeEach(() => {
    // Leave Undici's microtasks alone and advance the client's polling clock.
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  });

  async function finishPolling(pending: ReturnType<typeof executeLogQuery>) {
    await vi.runAllTimersAsync();
    return pending;
  }

  it("polls pending jobs until FIN and returns their logs", async () => {
    intercept(submit).reply(200, successXml("<job>42</job>"));
    intercept(poll).reply(200, successXml("<job><status>PEND</status></job>"));
    intercept(poll).reply(200, successXml("<job><status>ACT</status></job>"));
    intercept(poll).reply(200, successXml('<job><status>FIN</status></job><log><logs count="1" progress="100"><entry><action>allow</action></entry></logs></log>'));

    const pending = executeLogQuery("traffic", 20, query, target);
    await vi.advanceTimersByTimeAsync(0);
    expect(buildDispatcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(999);
    expect(buildDispatcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(buildDispatcher).toHaveBeenCalledTimes(2);

    expect(await finishPolling(pending)).toEqual({
      success: true,
      data: { "@_count": "1", "@_progress": "100", entry: { action: "allow" } },
    });
    expect(buildDispatcher).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts progress=100 without a job status and omits an absent filter", async () => {
    intercept({ type: "log", "log-type": "url", nlogs: "5" }).reply(200, successXml("<job>42</job>"));
    intercept(poll).reply(200, successXml('<log><logs count="0" progress="100"/></log>'));

    expect(await finishPolling(executeLogQuery("url", 5, undefined, target))).toEqual({
      success: true,
      data: { "@_count": "0", "@_progress": "100" },
    });
    expect(buildDispatcher).toHaveBeenCalledTimes(2);
  });

  it("does not poll when submission returns no job ID", async () => {
    intercept(submit).reply(200, successXml("<message>no job</message>"));

    expect(await executeLogQuery("traffic", 20, query, target)).toEqual({
      success: false,
      error: "No job ID returned from log query",
    });
    expect(buildDispatcher).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns submission errors without polling", async () => {
    intercept(submit).reply(200, apiErrorXml);

    expect(await executeLogQuery("traffic", 20, query, target)).toEqual(apiError);
    expect(buildDispatcher).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a submission transport failure", async () => {
    intercept(submit).replyWithError(new Error("connection refused"));

    expect(await executeLogQuery("traffic", 20, query, target)).toEqual({
      success: false,
      error: "Error submitting log query: fetch failed",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops polling on an API error", async () => {
    intercept(submit).reply(200, successXml("<job>42</job>"));
    intercept(poll).reply(200, apiErrorXml);

    expect(await finishPolling(executeLogQuery("traffic", 20, query, target))).toEqual(apiError);
    expect(buildDispatcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a polling transport failure", async () => {
    intercept(submit).reply(200, successXml("<job>42</job>"));
    intercept(poll).replyWithError(new Error("connection refused"));

    expect(await finishPolling(executeLogQuery("traffic", 20, query, target))).toEqual({
      success: false,
      error: "Error polling log results: fetch failed",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out after 30 pending polls without leaving a timer behind", async () => {
    intercept(submit).reply(200, successXml("<job>42</job>"));
    intercept(poll).reply(200, successXml("<job><status>ACT</status></job>")).times(30);

    const startedAt = Date.now();
    expect(await finishPolling(executeLogQuery("traffic", 20, query, target))).toEqual({
      success: false,
      error: "Log query timed out after 30 seconds (job 42)",
    });
    expect(buildDispatcher).toHaveBeenCalledTimes(31);
    expect(Date.now() - startedAt).toBe(30_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
