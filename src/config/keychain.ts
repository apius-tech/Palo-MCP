type KeyringEntry = {
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): boolean;
};
type EntryCtor = new (service: string, username: string) => KeyringEntry;

const SERVICE = "panos-mcp";
let EntryClass: EntryCtor | null | undefined;
let keychainAvailable = false;

async function ensureLoaded(): Promise<void> {
  if (EntryClass !== undefined) return;
  try {
    const mod = await import("@napi-rs/keyring");
    const E = (mod as { Entry: EntryCtor }).Entry;
    new E(SERVICE, "__availability_test__").getPassword();
    EntryClass = E;
    keychainAvailable = true;
  } catch {
    EntryClass = null;
    keychainAvailable = false;
    process.stderr.write(
      "[panos-mcp] WARNING: Keychain unavailable — API keys will be stored in plaintext\n"
    );
  }
}

export async function initKeychain(): Promise<void> {
  await ensureLoaded();
}

export function isKeychainAvailable(): boolean {
  return keychainAvailable;
}

export async function getKey(name: string): Promise<string | null> {
  await ensureLoaded();
  if (!keychainAvailable || !EntryClass) return null;
  try {
    return new EntryClass(SERVICE, name).getPassword() ?? null;
  } catch {
    return null;
  }
}

export async function setKey(name: string, key: string): Promise<void> {
  await ensureLoaded();
  if (!EntryClass) return;
  new EntryClass(SERVICE, name).setPassword(key);
}

export async function deleteKey(name: string): Promise<void> {
  await ensureLoaded();
  if (!EntryClass) return;
  try {
    new EntryClass(SERVICE, name).deletePassword();
  } catch {
    // entry doesn't exist, ignore
  }
}
