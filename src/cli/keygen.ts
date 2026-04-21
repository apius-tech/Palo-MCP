#!/usr/bin/env node

import { createInterface } from "readline";
import { generateApiKey } from "../api/client.js";
import { saveFirewallEntry } from "../config/firewalls.js";
import { isKeychainAvailable } from "../config/keychain.js";

function parseArgs(argv: string[]): { host?: string; user?: string; name?: string } {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--host" && argv[i + 1]) args.host = argv[++i];
    else if (arg === "--user" && argv[i + 1]) args.user = argv[++i];
    else if (arg === "--name" && argv[i + 1]) args.name = argv[++i];
  }
  return args;
}

function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });

    // Disable echo for password input
    if (process.stdin.isTTY) {
      process.stderr.write(prompt);
      process.stdin.setRawMode(true);
      let password = "";
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r") {
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onData);
          process.stderr.write("\n");
          rl.close();
          resolve(password);
        } else if (c === "\u0003") {
          // Ctrl+C
          process.stderr.write("\n");
          process.exit(1);
        } else if (c === "\u007f" || c === "\b") {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stderr.write("\b \b");
          }
        } else {
          password += c;
          process.stderr.write("*");
        }
      };
      process.stdin.on("data", onData);
    } else {
      // Non-TTY: read line normally (e.g. piped input)
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.host || !args.user) {
    console.error("Usage: panos-keygen --host <hostname> --user <username> [--name <save-name>]");
    process.exit(1);
  }

  const password = await readPassword("Password: ");
  if (!password) {
    console.error("Error: password is required");
    process.exit(1);
  }

  const result = await generateApiKey(args.host, args.user, password);

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  const key = result.data.key;
  console.log(key);

  if (args.name) {
    await saveFirewallEntry({ name: args.name, host: args.host, api_key: key });
    if (isKeychainAvailable()) {
      console.error(`Saved "${args.name}" — host in firewalls.json, key in system keychain`);
    } else {
      console.error(`Saved "${args.name}" in firewalls.json (WARNING: API key stored in plaintext)`);
    }
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
