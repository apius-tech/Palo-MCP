import { Entry } from "@napi-rs/keyring";

const SERVICE = "panos-mcp";
let keychainAvailable: boolean | null = null;

function checkKeychainAvailable(): boolean {
  if (keychainAvailable !== null) return keychainAvailable;
  try {
    new Entry(SERVICE, "__availability_test__").getPassword();
    keychainAvailable = true;
  } catch {
    keychainAvailable = false;
    process.stderr.write(
      "[panos-mcp] WARNING: Keychain unavailable — API keys will be stored in plaintext\n"
    );
  }
  return keychainAvailable;
}

export function isKeychainAvailable(): boolean {
  return checkKeychainAvailable();
}

export async function getKey(name: string): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  try {
    return new Entry(SERVICE, name).getPassword() ?? null;
  } catch {
    return null;
  }
}

export async function setKey(name: string, key: string): Promise<void> {
  new Entry(SERVICE, name).setPassword(key);
}

export async function deleteKey(name: string): Promise<void> {
  try {
    new Entry(SERVICE, name).deletePassword();
  } catch {
    // entry doesn't exist, ignore
  }
}
