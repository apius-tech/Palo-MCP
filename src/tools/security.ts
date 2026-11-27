import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConfig, setConfig, deleteConfig, moveConfig, formatResponse, resolveTarget, isApiError } from "../api/client.js";
import { firewallName, xmlEscape } from "../schemas/panos.js";

function members(items: string[]): string {
  return items.map(i => `<member>${xmlEscape(i)}</member>`).join("");
}

export function registerSecurityTools(server: McpServer) {
  server.tool(
    "get_security_rules",
    "[READ-ONLY] Retrieves all security policy rules from the firewall. Reads config at: /config/.../rulebase/security/rules.",
    {
      firewall: firewallName,
    },
    { title: "Get Security Rules", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/security/rules", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_security_profiles",
    "[READ-ONLY] Retrieves security profiles including antivirus, vulnerability, spyware, and URL filtering profiles. Reads config at: /config/.../vsys/entry/profiles.",
    {
      firewall: firewallName,
    },
    { title: "Get Security Profiles", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/profiles", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_security_profile_groups",
    "[READ-ONLY] Retrieves security profile groups that combine multiple security profiles. Reads config at: /config/.../vsys/entry/profile-group.",
    {
      firewall: firewallName,
    },
    { title: "Get Security Profile Groups", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/profile-group", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_pbf_rules",
    "[READ-ONLY] Retrieves policy-based forwarding (PBF) rules. Reads config at: /config/.../rulebase/pbf/rules.",
    {
      firewall: firewallName,
    },
    { title: "Get PBF Rules", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/pbf/rules", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_dos_profiles",
    "[READ-ONLY] Retrieves DoS protection profiles. Reads config at: /config/.../profiles/dos-protection.",
    {
      firewall: firewallName,
    },
    { title: "Get Dos Profiles", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/profiles/dos-protection", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_qos_rules",
    "[READ-ONLY] Retrieves QoS policy rules. Reads config at: /config/.../rulebase/qos/rules.",
    {
      firewall: firewallName,
    },
    { title: "Get QoS Rules", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/qos/rules", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "add_security_rule",
    "[MODIFIES CONFIG] Creates a new security policy rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      from_zones: z.array(z.string().min(1)).min(1).describe("Source zones (e.g. ['trust', 'dmz'])"),
      to_zones: z.array(z.string().min(1)).min(1).describe("Destination zones (e.g. ['untrust'])"),
      source: z.array(z.string().min(1)).min(1).describe("Source addresses or 'any'"),
      source_user: z.array(z.string().min(1)).min(1).optional().describe("Source users or groups (e.g. ['example\\jdoe', 'cn=admins,ou=groups,dc=example,dc=com']) or 'any', 'known-user', 'unknown', 'pre-logon'. Omit for PanOS default (any)."),
      destination: z.array(z.string().min(1)).min(1).describe("Destination addresses or 'any'"),
      application: z.array(z.string().min(1)).min(1).describe("Applications (e.g. ['web-browsing', 'ssl']) or 'any'"),
      service: z.array(z.string().min(1)).min(1).describe("Services (e.g. ['application-default', 'service-http']) or 'any'"),
      action: z.enum(["allow", "deny", "drop", "reset-client", "reset-server", "reset-both"]).describe("Rule action"),
      log_end: z.boolean().optional().describe("Log at session end (default: true in PanOS)"),
      log_start: z.boolean().optional().describe("Log at session start"),
      profile_group: z.string().optional().describe("Security profile group name to apply"),
      description: z.string().max(1023).optional().describe("Optional description"),
      disabled: z.boolean().optional().describe("Create rule in disabled state"),
      tag: z.array(z.string().min(1)).optional().describe("Tags to apply to the rule"),
      firewall: firewallName,
    },
    { title: "Add Security Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, from_zones, to_zones, source, source_user, destination, application, service, action, log_end, log_start, profile_group, description, disabled, tag, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = "/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/security/rules";
      let element = `<entry name="${xmlEscape(name)}">`;
      element += `<from>${members(from_zones)}</from>`;
      element += `<to>${members(to_zones)}</to>`;
      element += `<source>${members(source)}</source>`;
      if (source_user && source_user.length > 0) element += `<source-user>${members(source_user)}</source-user>`;
      element += `<destination>${members(destination)}</destination>`;
      element += `<application>${members(application)}</application>`;
      element += `<service>${members(service)}</service>`;
      element += `<action>${action}</action>`;
      if (log_end !== undefined) element += `<log-end>${log_end ? "yes" : "no"}</log-end>`;
      if (log_start !== undefined) element += `<log-start>${log_start ? "yes" : "no"}</log-start>`;
      if (profile_group) element += `<profile-setting><group><member>${xmlEscape(profile_group)}</member></group></profile-setting>`;
      if (description) element += `<description>${xmlEscape(description)}</description>`;
      if (disabled !== undefined) element += `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      if (tag && tag.length > 0) element += `<tag>${members(tag)}</tag>`;
      element += `</entry>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "move_security_rule",
    "[MODIFIES CONFIG] Moves a security policy rule to a new position in the rulebase. Rule order determines evaluation priority. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Name of the security rule to move"),
      where: z.enum(["top", "bottom", "before", "after"]).describe("Position to move the rule to"),
      destination: z.string().optional().describe("Reference rule name (required when 'where' is 'before' or 'after')"),
      firewall: firewallName,
    },
    { title: "Move Security Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, where, destination, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      if ((where === "before" || where === "after") && !destination) {
        return formatResponse({ success: false, error: "'destination' is required when 'where' is 'before' or 'after'" });
      }
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/security/rules/entry[@name='${name}']`;
      const result = await moveConfig(xpath, where, destination, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "delete_security_rule",
    "[MODIFIES CONFIG] Deletes a security policy rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name to delete"),
      firewall: firewallName,
    },
    { title: "Delete Security Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/security/rules/entry[@name='${name}']`;
      const result = await deleteConfig(xpath, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "set_security_rule_disabled",
    "[MODIFIES CONFIG] Enables or disables a security policy rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      disabled: z.boolean().describe("true to disable the rule, false to enable it"),
      firewall: firewallName,
    },
    { title: "Set Security Rule Disabled", readOnlyHint: false, destructiveHint: true },
    async ({ name, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/security/rules/entry[@name='${name}']`;
      const element = `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );

  // PBF rule tools

  server.tool(
    "add_pbf_rule",
    "[MODIFIES CONFIG] Creates a new policy-based forwarding (PBF) rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      from_zones: z.array(z.string().min(1)).min(1).describe("Source zones"),
      source: z.array(z.string().min(1)).min(1).describe("Source addresses or 'any'"),
      source_user: z.array(z.string().min(1)).min(1).optional().describe("Source users or groups (e.g. ['example\\jdoe', 'cn=admins,ou=groups,dc=example,dc=com']) or 'any', 'known-user', 'unknown', 'pre-logon'. Omit for PanOS default (any)."),
      action: z.enum(["forward", "discard", "no-pbf"]).describe("PBF action"),
      egress_interface: z.string().optional().describe("Egress interface (required for 'forward' action)"),
      next_hop_type: z.enum(["ip-address", "fqdn"]).optional().describe("Next-hop type (for 'forward' action)"),
      next_hop_value: z.string().optional().describe("Next-hop IP address or FQDN value"),
      description: z.string().max(1023).optional().describe("Optional description"),
      disabled: z.boolean().optional().describe("Create rule in disabled state"),
      firewall: firewallName,
    },
    { title: "Add PBF Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, from_zones, source, source_user, action, egress_interface, next_hop_type, next_hop_value, description, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = "/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/pbf/rules";
      let element = `<entry name="${xmlEscape(name)}">`;
      element += `<from><zone>${members(from_zones)}</zone></from>`;
      element += `<source>${members(source)}</source>`;
      if (source_user && source_user.length > 0) element += `<source-user>${members(source_user)}</source-user>`;
      element += `<action>`;
      if (action === "forward") {
        element += `<forward>`;
        if (egress_interface) element += `<egress-interface>${xmlEscape(egress_interface)}</egress-interface>`;
        if (next_hop_type && next_hop_value) {
          element += `<nexthop><${next_hop_type}>${xmlEscape(next_hop_value)}</${next_hop_type}></nexthop>`;
        }
        element += `</forward>`;
      } else if (action === "discard") {
        element += `<discard/>`;
      } else {
        element += `<no-pbf/>`;
      }
      element += `</action>`;
      if (description) element += `<description>${xmlEscape(description)}</description>`;
      if (disabled !== undefined) element += `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      element += `</entry>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "move_pbf_rule",
    "[MODIFIES CONFIG] Moves a PBF rule to a new position in the rulebase. Rule order determines evaluation priority. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Name of the PBF rule to move"),
      where: z.enum(["top", "bottom", "before", "after"]).describe("Position to move the rule to"),
      destination: z.string().optional().describe("Reference rule name (required when 'where' is 'before' or 'after')"),
      firewall: firewallName,
    },
    { title: "Move PBF Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, where, destination, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      if ((where === "before" || where === "after") && !destination) {
        return formatResponse({ success: false, error: "'destination' is required when 'where' is 'before' or 'after'" });
      }
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/pbf/rules/entry[@name='${name}']`;
      const result = await moveConfig(xpath, where, destination, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "delete_pbf_rule",
    "[MODIFIES CONFIG] Deletes a PBF rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name to delete"),
      firewall: firewallName,
    },
    { title: "Delete PBF Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/pbf/rules/entry[@name='${name}']`;
      const result = await deleteConfig(xpath, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "set_pbf_rule_disabled",
    "[MODIFIES CONFIG] Enables or disables a PBF rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      disabled: z.boolean().describe("true to disable the rule, false to enable it"),
      firewall: firewallName,
    },
    { title: "Set PBF Rule Disabled", readOnlyHint: false, destructiveHint: true },
    async ({ name, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/pbf/rules/entry[@name='${name}']`;
      const element = `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );

  // QoS rule tools

  server.tool(
    "add_qos_rule",
    "[MODIFIES CONFIG] Creates a new QoS policy rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      from_zones: z.array(z.string().min(1)).min(1).describe("Source zones"),
      to_zones: z.array(z.string().min(1)).min(1).describe("Destination zones"),
      source: z.array(z.string().min(1)).min(1).describe("Source addresses or 'any'"),
      source_user: z.array(z.string().min(1)).min(1).optional().describe("Source users or groups (e.g. ['example\\jdoe', 'cn=admins,ou=groups,dc=example,dc=com']) or 'any', 'known-user', 'unknown', 'pre-logon'. Omit for PanOS default (any)."),
      destination: z.array(z.string().min(1)).min(1).describe("Destination addresses or 'any'"),
      application: z.array(z.string().min(1)).min(1).describe("Applications or 'any'"),
      service: z.array(z.string().min(1)).min(1).describe("Services or 'any'"),
      action_class: z.string().min(1).max(1).describe("QoS class number (1-8)"),
      description: z.string().max(1023).optional().describe("Optional description"),
      disabled: z.boolean().optional().describe("Create rule in disabled state"),
      firewall: firewallName,
    },
    { title: "Add QoS Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, from_zones, to_zones, source, source_user, destination, application, service, action_class, description, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = "/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/qos/rules";
      let element = `<entry name="${xmlEscape(name)}">`;
      element += `<from>${members(from_zones)}</from>`;
      element += `<to>${members(to_zones)}</to>`;
      element += `<source>${members(source)}</source>`;
      if (source_user && source_user.length > 0) element += `<source-user>${members(source_user)}</source-user>`;
      element += `<destination>${members(destination)}</destination>`;
      element += `<application>${members(application)}</application>`;
      element += `<service>${members(service)}</service>`;
      element += `<action><class>${action_class}</class></action>`;
      if (description) element += `<description>${xmlEscape(description)}</description>`;
      if (disabled !== undefined) element += `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      element += `</entry>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "move_qos_rule",
    "[MODIFIES CONFIG] Moves a QoS rule to a new position in the rulebase. Rule order determines evaluation priority. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Name of the QoS rule to move"),
      where: z.enum(["top", "bottom", "before", "after"]).describe("Position to move the rule to"),
      destination: z.string().optional().describe("Reference rule name (required when 'where' is 'before' or 'after')"),
      firewall: firewallName,
    },
    { title: "Move QoS Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, where, destination, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      if ((where === "before" || where === "after") && !destination) {
        return formatResponse({ success: false, error: "'destination' is required when 'where' is 'before' or 'after'" });
      }
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/qos/rules/entry[@name='${name}']`;
      const result = await moveConfig(xpath, where, destination, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "delete_qos_rule",
    "[MODIFIES CONFIG] Deletes a QoS rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name to delete"),
      firewall: firewallName,
    },
    { title: "Delete QoS Rule", readOnlyHint: false, destructiveHint: true },
    async ({ name, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/qos/rules/entry[@name='${name}']`;
      const result = await deleteConfig(xpath, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "set_qos_rule_disabled",
    "[MODIFIES CONFIG] Enables or disables a QoS rule. Staged in candidate config — requires 'commit' to activate.",
    {
      name: z.string().min(1).max(63).describe("Rule name"),
      disabled: z.boolean().describe("true to disable the rule, false to enable it"),
      firewall: firewallName,
    },
    { title: "Set QoS Rule Disabled", readOnlyHint: false, destructiveHint: true },
    async ({ name, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/qos/rules/entry[@name='${name}']`;
      const element = `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );
}
