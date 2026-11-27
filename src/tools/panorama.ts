import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeOpCommand, getConfig, setConfig, deleteConfig, moveConfig, formatResponse, resolveTarget, isApiError } from "../api/client.js";
import { deviceGroup, firewallName, xmlEscape } from "../schemas/panos.js";

function members(items: string[]): string {
  return items.map(i => `<member>${xmlEscape(i)}</member>`).join("");
}

export function registerPanoramaTools(server: McpServer) {
  // Managed Devices
  server.tool(
    "panorama_get_managed_devices",
    "[READ-ONLY] Retrieves all firewalls managed by Panorama with their connection status. Executes: show devices all.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Managed Devices", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand("<show><devices><all></all></devices></show>", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_device_groups",
    "[READ-ONLY] Retrieves all device groups configured in Panorama. Reads config at: /config/.../device-group.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Device Groups", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/device-group", target);
      return formatResponse(result);
    }
  );

  // Templates
  server.tool(
    "panorama_get_templates",
    "[READ-ONLY] Retrieves all templates configured in Panorama. Reads config at: /config/.../template.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Templates", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/template", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_template_stacks",
    "[READ-ONLY] Retrieves all template stacks configured in Panorama. Reads config at: /config/.../template-stack.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Template Stacks", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/template-stack", target);
      return formatResponse(result);
    }
  );

  // Shared Objects (Panorama-level)
  server.tool(
    "panorama_get_shared_address_objects",
    "[READ-ONLY] Retrieves shared address objects defined at Panorama level. Reads config at: /config/shared/address.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Shared Address Objects", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/shared/address", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_shared_address_groups",
    "[READ-ONLY] Retrieves shared address groups defined at Panorama level. Reads config at: /config/shared/address-group.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Shared Address Groups", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/shared/address-group", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_shared_service_objects",
    "[READ-ONLY] Retrieves shared service objects defined at Panorama level. Reads config at: /config/shared/service.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Shared Service Objects", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/shared/service", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_shared_service_groups",
    "[READ-ONLY] Retrieves shared service groups defined at Panorama level. Reads config at: /config/shared/service-group.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Shared Service Groups", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/shared/service-group", target);
      return formatResponse(result);
    }
  );

  // Pre/Post Rules (Panorama-pushed policies)
  server.tool(
    "panorama_get_pre_rules",
    "[READ-ONLY] Retrieves pre-rules from a device group (rules pushed before local firewall rules). Reads config at: /config/.../device-group/entry/pre-rulebase/security/rules.",
    {
      device_group: deviceGroup,
      firewall: firewallName,
    },
    { title: "Panorama Get Pre Rules", readOnlyHint: true, destructiveHint: false },
    async ({ device_group, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig(
        `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/pre-rulebase/security/rules`,
        target
      );
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_post_rules",
    "[READ-ONLY] Retrieves post-rules from a device group (rules pushed after local firewall rules). Reads config at: /config/.../device-group/entry/post-rulebase/security/rules.",
    {
      device_group: deviceGroup,
      firewall: firewallName,
    },
    { title: "Panorama Get Post Rules", readOnlyHint: true, destructiveHint: false },
    async ({ device_group, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig(
        `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/post-rulebase/security/rules`,
        target
      );
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_device_group_nat_rules",
    "[READ-ONLY] Retrieves NAT rules from a device group (pre or post rulebase). Reads config at: /config/.../device-group/entry/{pre|post}-rulebase/nat/rules.",
    {
      device_group: deviceGroup,
      rulebase: z.enum(["pre", "post"]).describe("Rulebase type: 'pre' or 'post'"),
      firewall: firewallName,
    },
    { title: "Panorama Get Device Group NAT Rules", readOnlyHint: true, destructiveHint: false },
    async ({ device_group, rulebase, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig(
        `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/${rulebase}-rulebase/nat/rules`,
        target
      );
      return formatResponse(result);
    }
  );

  // Log Collectors
  server.tool(
    "panorama_get_log_collectors",
    "[READ-ONLY] Retrieves log collector configuration and status from Panorama. Executes: show log-collector all.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Log Collectors", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand("<show><log-collector><all></all></log-collector></show>", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_collector_groups",
    "[READ-ONLY] Retrieves collector group configuration from Panorama. Reads config at: /config/.../log-collector-group.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Collector Groups", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/devices/entry[@name='localhost.localdomain']/log-collector-group", target);
      return formatResponse(result);
    }
  );

  // Push Status
  server.tool(
    "panorama_get_push_status",
    "[READ-ONLY] Retrieves the status of the last configuration push to managed devices. Executes: show config push status.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Push Status", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand("<show><config><push><status></status></push></config></show>", target);
      return formatResponse(result);
    }
  );

  // Commit Status
  server.tool(
    "panorama_get_commit_status",
    "[READ-ONLY] Retrieves the status of pending commits in Panorama. Executes: show jobs all.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Commit Status", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand("<show><jobs><all></all></jobs></show>", target);
      return formatResponse(result);
    }
  );

  // Software/Content Versions on Managed Devices
  server.tool(
    "panorama_get_managed_device_software",
    "[READ-ONLY] Retrieves software and content versions on all managed firewalls. Executes: show devices all.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Managed Device Software", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand("<show><devices><all></all></devices></show>", target);
      return formatResponse(result);
    }
  );

  // Panorama HA
  server.tool(
    "panorama_get_ha_status",
    "[READ-ONLY] Retrieves Panorama high-availability status for Panorama HA pairs. Executes: show high-availability state.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get HA Status", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand("<show><high-availability><state></state></high-availability></show>", target);
      return formatResponse(result);
    }
  );

  // Device Group Hierarchy
  server.tool(
    "panorama_get_device_group_hierarchy",
    "[READ-ONLY] Retrieves the device group hierarchy showing parent-child relationships. Reads config at: /config/readonly/.../device-group.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Device Group Hierarchy", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/readonly/devices/entry[@name='localhost.localdomain']/device-group", target);
      return formatResponse(result);
    }
  );

  // Shared Security Profiles
  server.tool(
    "panorama_get_shared_security_profiles",
    "[READ-ONLY] Retrieves shared security profiles defined at Panorama level. Reads config at: /config/shared/profiles.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Shared Security Profiles", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/shared/profiles", target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_get_shared_profile_groups",
    "[READ-ONLY] Retrieves shared security profile groups defined at Panorama level. Reads config at: /config/shared/profile-group.",
    {
      firewall: firewallName,
    },
    { title: "Panorama Get Shared Profile Groups", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await getConfig("/config/shared/profile-group", target);
      return formatResponse(result);
    }
  );

  // Panorama Pre-Rule CRUD

  server.tool(
    "panorama_add_pre_rule",
    "[MODIFIES CONFIG] Creates a security pre-rule in a Panorama device group (pushed before local firewall rules). Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      name: z.string().min(1).max(63).describe("Rule name"),
      from_zones: z.array(z.string().min(1)).min(1).describe("Source zones (e.g. ['trust', 'dmz'])"),
      to_zones: z.array(z.string().min(1)).min(1).describe("Destination zones (e.g. ['untrust'])"),
      source: z.array(z.string().min(1)).min(1).describe("Source addresses or 'any'"),
      source_user: z.array(z.string().min(1)).min(1).optional().describe("Source users or groups (e.g. ['example\\jdoe', 'cn=admins,ou=groups,dc=example,dc=com']) or 'any', 'known-user', 'unknown', 'pre-logon'. Omit for PanOS default (any)."),
      destination: z.array(z.string().min(1)).min(1).describe("Destination addresses or 'any'"),
      application: z.array(z.string().min(1)).min(1).describe("Applications (e.g. ['web-browsing', 'ssl']) or 'any'"),
      service: z.array(z.string().min(1)).min(1).describe("Services (e.g. ['application-default']) or 'any'"),
      action: z.enum(["allow", "deny", "drop", "reset-client", "reset-server", "reset-both"]).describe("Rule action"),
      log_end: z.boolean().optional().describe("Log at session end"),
      log_start: z.boolean().optional().describe("Log at session start"),
      profile_group: z.string().optional().describe("Security profile group name to apply"),
      description: z.string().max(1023).optional().describe("Optional description"),
      disabled: z.boolean().optional().describe("Create rule in disabled state"),
      tag: z.array(z.string().min(1)).optional().describe("Tags to apply to the rule"),
      firewall: firewallName,
    },
    { title: "Panorama Add Pre Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, name, from_zones, to_zones, source, source_user, destination, application, service, action, log_end, log_start, profile_group, description, disabled, tag, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/pre-rulebase/security/rules`;
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
    "panorama_move_pre_rule",
    "[MODIFIES CONFIG] Moves a security pre-rule to a new position in a Panorama device group rulebase. Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      name: z.string().min(1).max(63).describe("Name of the pre-rule to move"),
      where: z.enum(["top", "bottom", "before", "after"]).describe("Position to move the rule to"),
      destination: z.string().optional().describe("Reference rule name (required when 'where' is 'before' or 'after')"),
      firewall: firewallName,
    },
    { title: "Panorama Move Pre Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, name, where, destination, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      if ((where === "before" || where === "after") && !destination) {
        return formatResponse({ success: false, error: "'destination' is required when 'where' is 'before' or 'after'" });
      }
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/pre-rulebase/security/rules/entry[@name='${name}']`;
      const result = await moveConfig(xpath, where, destination, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_delete_pre_rule",
    "[MODIFIES CONFIG] Deletes a security pre-rule from a Panorama device group. Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      name: z.string().min(1).max(63).describe("Pre-rule name to delete"),
      firewall: firewallName,
    },
    { title: "Panorama Delete Pre Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, name, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/pre-rulebase/security/rules/entry[@name='${name}']`;
      const result = await deleteConfig(xpath, target);
      return formatResponse(result);
    }
  );

  // Panorama Post-Rule CRUD

  server.tool(
    "panorama_add_post_rule",
    "[MODIFIES CONFIG] Creates a security post-rule in a Panorama device group (pushed after local firewall rules). Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      name: z.string().min(1).max(63).describe("Rule name"),
      from_zones: z.array(z.string().min(1)).min(1).describe("Source zones (e.g. ['trust', 'dmz'])"),
      to_zones: z.array(z.string().min(1)).min(1).describe("Destination zones (e.g. ['untrust'])"),
      source: z.array(z.string().min(1)).min(1).describe("Source addresses or 'any'"),
      source_user: z.array(z.string().min(1)).min(1).optional().describe("Source users or groups (e.g. ['example\\jdoe', 'cn=admins,ou=groups,dc=example,dc=com']) or 'any', 'known-user', 'unknown', 'pre-logon'. Omit for PanOS default (any)."),
      destination: z.array(z.string().min(1)).min(1).describe("Destination addresses or 'any'"),
      application: z.array(z.string().min(1)).min(1).describe("Applications (e.g. ['web-browsing', 'ssl']) or 'any'"),
      service: z.array(z.string().min(1)).min(1).describe("Services (e.g. ['application-default']) or 'any'"),
      action: z.enum(["allow", "deny", "drop", "reset-client", "reset-server", "reset-both"]).describe("Rule action"),
      log_end: z.boolean().optional().describe("Log at session end"),
      log_start: z.boolean().optional().describe("Log at session start"),
      profile_group: z.string().optional().describe("Security profile group name to apply"),
      description: z.string().max(1023).optional().describe("Optional description"),
      disabled: z.boolean().optional().describe("Create rule in disabled state"),
      tag: z.array(z.string().min(1)).optional().describe("Tags to apply to the rule"),
      firewall: firewallName,
    },
    { title: "Panorama Add Post Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, name, from_zones, to_zones, source, source_user, destination, application, service, action, log_end, log_start, profile_group, description, disabled, tag, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/post-rulebase/security/rules`;
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
    "panorama_move_post_rule",
    "[MODIFIES CONFIG] Moves a security post-rule to a new position in a Panorama device group rulebase. Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      name: z.string().min(1).max(63).describe("Name of the post-rule to move"),
      where: z.enum(["top", "bottom", "before", "after"]).describe("Position to move the rule to"),
      destination: z.string().optional().describe("Reference rule name (required when 'where' is 'before' or 'after')"),
      firewall: firewallName,
    },
    { title: "Panorama Move Post Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, name, where, destination, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      if ((where === "before" || where === "after") && !destination) {
        return formatResponse({ success: false, error: "'destination' is required when 'where' is 'before' or 'after'" });
      }
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/post-rulebase/security/rules/entry[@name='${name}']`;
      const result = await moveConfig(xpath, where, destination, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_delete_post_rule",
    "[MODIFIES CONFIG] Deletes a security post-rule from a Panorama device group. Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      name: z.string().min(1).max(63).describe("Post-rule name to delete"),
      firewall: firewallName,
    },
    { title: "Panorama Delete Post Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, name, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/post-rulebase/security/rules/entry[@name='${name}']`;
      const result = await deleteConfig(xpath, target);
      return formatResponse(result);
    }
  );

  // Panorama Device Group NAT Rule CRUD

  server.tool(
    "panorama_add_device_group_nat_rule",
    "[MODIFIES CONFIG] Creates a NAT rule in a Panorama device group (pre or post rulebase). Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      rulebase: z.enum(["pre", "post"]).describe("Rulebase type: 'pre' or 'post'"),
      name: z.string().min(1).max(63).describe("NAT rule name"),
      from_zones: z.array(z.string().min(1)).min(1).describe("Source zones"),
      to_zones: z.array(z.string().min(1)).min(1).describe("Destination zones"),
      source: z.array(z.string().min(1)).min(1).describe("Source addresses or 'any'"),
      destination: z.array(z.string().min(1)).min(1).describe("Destination addresses or 'any'"),
      service: z.string().min(1).describe("Service (e.g. 'any', 'service-http')"),
      snat_type: z.enum(["dynamic-ip-and-port", "dynamic-ip", "static-ip"]).optional().describe("Source NAT type"),
      snat_address: z.string().optional().describe("Source NAT translated address"),
      snat_interface: z.string().optional().describe("Source NAT interface (for dynamic-ip-and-port)"),
      dnat_address: z.string().optional().describe("Destination NAT translated address"),
      dnat_port: z.string().optional().describe("Destination NAT translated port"),
      description: z.string().max(1023).optional().describe("Optional description"),
      disabled: z.boolean().optional().describe("Create rule in disabled state"),
      firewall: firewallName,
    },
    { title: "Panorama Add Device Group NAT Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, rulebase, name, from_zones, to_zones, source, destination, service, snat_type, snat_address, snat_interface, dnat_address, dnat_port, description, disabled, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/${rulebase}-rulebase/nat/rules`;
      let element = `<entry name="${xmlEscape(name)}">`;
      element += `<from>${members(from_zones)}</from>`;
      element += `<to>${members(to_zones)}</to>`;
      element += `<source>${members(source)}</source>`;
      element += `<destination>${members(destination)}</destination>`;
      element += `<service>${xmlEscape(service)}</service>`;
      if (snat_type) {
        element += `<source-translation>`;
        if (snat_type === "dynamic-ip-and-port") {
          element += `<dynamic-ip-and-port>`;
          if (snat_interface) {
            element += `<interface-address><interface>${xmlEscape(snat_interface)}</interface></interface-address>`;
          } else if (snat_address) {
            element += `<translated-address>${members([snat_address])}</translated-address>`;
          }
          element += `</dynamic-ip-and-port>`;
        } else if (snat_type === "dynamic-ip") {
          element += `<dynamic-ip>`;
          if (snat_address) element += `<translated-address>${members([snat_address])}</translated-address>`;
          element += `</dynamic-ip>`;
        } else if (snat_type === "static-ip") {
          element += `<static-ip>`;
          if (snat_address) element += `<translated-address>${xmlEscape(snat_address)}</translated-address>`;
          element += `</static-ip>`;
        }
        element += `</source-translation>`;
      }
      if (dnat_address) {
        element += `<destination-translation><translated-address>${xmlEscape(dnat_address)}</translated-address>`;
        if (dnat_port) element += `<translated-port>${xmlEscape(dnat_port)}</translated-port>`;
        element += `</destination-translation>`;
      }
      if (description) element += `<description>${xmlEscape(description)}</description>`;
      if (disabled !== undefined) element += `<disabled>${disabled ? "yes" : "no"}</disabled>`;
      element += `</entry>`;
      const result = await setConfig(xpath, element, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_move_device_group_nat_rule",
    "[MODIFIES CONFIG] Moves a NAT rule to a new position in a Panorama device group rulebase. Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      rulebase: z.enum(["pre", "post"]).describe("Rulebase type: 'pre' or 'post'"),
      name: z.string().min(1).max(63).describe("Name of the NAT rule to move"),
      where: z.enum(["top", "bottom", "before", "after"]).describe("Position to move the rule to"),
      destination: z.string().optional().describe("Reference rule name (required when 'where' is 'before' or 'after')"),
      firewall: firewallName,
    },
    { title: "Panorama Move Device Group NAT Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, rulebase, name, where, destination, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      if ((where === "before" || where === "after") && !destination) {
        return formatResponse({ success: false, error: "'destination' is required when 'where' is 'before' or 'after'" });
      }
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/${rulebase}-rulebase/nat/rules/entry[@name='${name}']`;
      const result = await moveConfig(xpath, where, destination, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "panorama_delete_device_group_nat_rule",
    "[MODIFIES CONFIG] Deletes a NAT rule from a Panorama device group. Staged in candidate config — requires 'panorama_commit' then 'panorama_push_to_devices' to activate.",
    {
      device_group: deviceGroup,
      rulebase: z.enum(["pre", "post"]).describe("Rulebase type: 'pre' or 'post'"),
      name: z.string().min(1).max(63).describe("NAT rule name to delete"),
      firewall: firewallName,
    },
    { title: "Panorama Delete Device Group NAT Rule", readOnlyHint: false, destructiveHint: true },
    async ({ device_group, rulebase, name, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const xpath = `/config/devices/entry[@name='localhost.localdomain']/device-group/entry[@name='${device_group}']/${rulebase}-rulebase/nat/rules/entry[@name='${name}']`;
      const result = await deleteConfig(xpath, target);
      return formatResponse(result);
    }
  );
}
