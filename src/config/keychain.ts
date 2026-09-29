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
    EntryClass = (mod as { Entry: EntryCtor }).Entry;
    keychainAvailable = true;
  } catch {
    EntryClass = null;
    keychainAvailable = false;
    process.stderr.write(
      "[panos-mcp] WARNING: Keychain unavailable — API keys will be stored in plaintext\n"
    );
    return;
  }
  // A probe error (locked keychain, denied access) means the store exists but is
  // failing right now. Keep it marked available so keys are never downgraded to
  // plaintext because of a transient error — reads and writes surface it instead.
  try {
    new EntryClass(SERVICE, "__availability_test__").getPassword();
  } catch (err) {
    process.stderr.write(`[panos-mcp] WARNING: Keychain probe failed — ${describe(err)}\n`);
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  } catch (err) {
    process.stderr.write(`[panos-mcp] WARNING: Keychain read failed for "${name}" — ${describe(err)}\n`);
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
