---
name: panos-change-workflow
description: Safe workflow for changing a Palo Alto Networks firewall or Panorama with the PanOS tools. Use whenever the user asks to add, edit, move, disable, or delete security or NAT rules, objects, routes, or any other PAN-OS configuration, or asks to commit or push configuration.
---

# Changing PAN-OS configuration safely

Every change the PanOS tools make lands in the **candidate** configuration. Nothing affects traffic until a commit. Use that gap to let the user review.

## 1. Pick the target

- If more than one firewall may be configured, call `list_firewalls` first and pass `firewall` on every call.
- On Panorama, confirm the device group (`panorama_get_device_groups`) and whether the change belongs in pre-rules or post-rules.

## 2. Read before you write

- Read the current state with the matching `get_*` tool before changing it: `get_security_rules` before adding or moving a rule, `get_address_objects` before creating an object, and so on.
- Reuse existing objects and tags instead of creating duplicates.
- For rule placement, show where the new or moved rule sits relative to its neighbours. Rule order decides which rule matches.

## 3. Stage the change

- Prefer the dedicated tools (`add_security_rule`, `move_nat_rule`, `set_security_rule_disabled`, ...) over `set_config` and `delete_config`. They validate input and build correct XPaths.
- Use `set_config`, `delete_config`, and `run_op_command` only when no dedicated tool covers the change, and say so.

## 4. Confirm, then commit

- Before calling `commit`, `panorama_commit`, or `panorama_push_to_devices`, summarise exactly what is staged (what changes, on which target) and ask the user to confirm. Never commit in the same step as staging unless the user explicitly asked for it.
- Pass a short `description` to every commit so the change is traceable in the firewall's config log.
- On Panorama, `panorama_commit` only commits on Panorama. Pushing to firewalls is a separate step with `panorama_push_to_devices`, and it needs its own confirmation because it affects live traffic on every device in the group.

## 5. Verify

- After a commit, re-read the changed objects or rules, and check `get_config_logs` or `get_system_logs` for commit errors.
- If something failed, report the error text from the tool and don't retry destructive steps blindly.

Deleting rules or objects, `delete_config`, and anything that touches admin accounts, authentication, or HA always needs an explicit confirmation from the user, even when they asked for a batch of changes.
