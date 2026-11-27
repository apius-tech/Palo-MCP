import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConfig, setConfig, deleteConfig, moveConfig, formatResponse, resolveTarget, isApiError } from "../api/client.js";
import { firewallName, xmlEscape } from "../schemas/panos.js";

function members(items: string[]): string {
  return items.map(i => `<member>${xmlEscape(i)}</member>`).join("");
}

export function registerCertificatesTools(server: McpServer) {
  server.tool(
    "get_certificates",
    "[READ-ONLY] Retrieves SSL/TLS certificates configured on the firewall. Reads config at: /config/shared/certificate.",
    {
      firewall: firewallName,
    },
    { title: "Get Certificates", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/shared/certificate", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_decryption_rules",
    "[READ-ONLY] Retrieves SSL decryption policy rules. Reads config at: /config/.../rulebase/decryption/rules.",
    {
      firewall: firewallName,
    },
    { title: "Get Decryption Rules", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/decryption/rules", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_decryption_profiles",
    "[READ-ONLY] Retrieves SSL decryption profiles. Reads config at: /config/.../profiles/decryption.",
    {
      firewall: firewallName,
    },
    { title: "Get Decryption Profiles", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/profiles/decryption", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "add_decryption_rule",
    "[MODIFIES CONFIG] Creates a new SSL decryption policy rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      from_zones: z.array(z.string().min(1)).min(1).describe("Source zones"),
      to_zones: z.array(z.string().min(1)).min(1).describe("Destination zones"),
      source: z.array(z.string().min(1)).min(1).describe("Source addresses or 'any'"),
      source_user: z.array(z.string().min(1)).min(1).optional().describe("Source users or groups (e.g. ['example\\jdoe', 'cn=admins,ou=groups,dc=example,dc=com']) or 'any', 'known-user', 'unknown', 'pre-logon'. Omit for PanOS default (any)."),
      destination: z.array(z.string().min(1)).min(1).describe("Destination addresses or 'any'"),
      service: z.array(z.string().min(1)).min(1).describe("Services or 'any'"),
      action: z.enum(["decrypt", "no-decrypt"]).describe("Decrypt or pass through"),
      type: z.enum(["ssl-forward-proxy", "ssh-proxy", "ssl-inbound-inspection"]).optional().describe("Decryption type (required when action is 'decrypt')"),
      decryption_profile: z.string().optional().describe("Decryption profile name to apply"),
      description: z.string().max(1023).optional().describe("Optional description"),
      disabled: z.boolean().optional().describe("Create rule in disabled state"),
      firewall: firewallName,
    },
    { title: "Add Decryption Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, from_zones, to_zones, source, source_user, destination, service, action, type, decryption_profile, description, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = "/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/decryption/rules";
      let element = `<entry name="${xmlEscape(name)}">`;
      element += `<from>${members(from_zones)}</from>`;
      element += `<to>${members(to_zones)}</to>`;
      element += `<source>${members(source)}</source>`;
      if (source_user && source_user.length > 0) element += `<source-user>${members(source_user)}</source-user>`;
      element += `<destination>${members(destination)}</destination>`;
      element += `<service>${members(service)}</service>`;
      element += `<action>${action}</action>`;
      if (type) element += `<type><${type}/></${"type"}>`;
      if (decryption_profile) element += `<profile>${xmlEscape(decryption_profile)}</profile>`;
      if (description) element += `<description>${xmlEscape(description)}</description>`;
      if (disabled !== undefined) element += `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      element += `</entry>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "move_decryption_rule",
    "[MODIFIES CONFIG] Moves a decryption policy rule to a new position in the rulebase. Rule order determines evaluation priority. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Name of the decryption rule to move"),
      where: z.enum(["top", "bottom", "before", "after"]).describe("Position to move the rule to"),
      destination: z.string().optional().describe("Reference rule name (required when 'where' is 'before' or 'after')"),
      firewall: firewallName,
    },
    { title: "Move Decryption Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, where, destination, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      if ((where === "before" || where === "after") && !destination) {
        return formatResponse({ success: false, error: "'destination' is required when 'where' is 'before' or 'after'" });
      }
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/decryption/rules/entry[@name='${name}']`;
      const result = await moveConfig(xpath, where, destination, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "delete_decryption_rule",
    "[MODIFIES CONFIG] Deletes a decryption policy rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name to delete"),
      firewall: firewallName,
    },
    { title: "Delete Decryption Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/decryption/rules/entry[@name='${name}']`;
      const result = await deleteConfig(xpath, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "set_decryption_rule_disabled",
    "[MODIFIES CONFIG] Enables or disables a decryption policy rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      disabled: z.boolean().describe("true to disable the rule, false to enable it"),
      firewall: firewallName,
    },
    { title: "Set Decryption Rule Disabled", readOnlyHint: false, destructiveHint: true },
    async ({ name, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/decryption/rules/entry[@name='${name}']`;
      const element = `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );
}
