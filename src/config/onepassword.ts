type EnvLike = Record<string, string | undefined>;
type OnePasswordClientConfiguration = {
  auth: string;
  integrationName: string;
  integrationVersion: string;
};
type CreateClient = (config: OnePasswordClientConfiguration) => Promise<OnePasswordClient>;
type LoadSdk = () => Promise<{ createClient: CreateClient }>;

interface OnePasswordEnvironmentVariable {
  name: string;
  value: string;
}

interface OnePasswordEnvironmentResponse {
  variables: OnePasswordEnvironmentVariable[];
}

interface OnePasswordClient {
  environments: {
    getVariables(environmentId: string): Promise<OnePasswordEnvironmentResponse>;
  };
}

export interface LoadOnePasswordEnvironmentOptions {
  env?: EnvLike;
  createClientImpl?: CreateClient;
  loadSdkImpl?: LoadSdk;
  allowedNames?: ReadonlySet<string>;
}

function readEnv(env: EnvLike, name: string): string {
  const value = (env[name] ?? "").trim();
  if (/^\$\{user_config\.[A-Za-z0-9_]+\}$/.test(value)) return "";
  return value;
}

function redact(message: string, secrets: string[]): string {
  let redacted = message;
  for (const secret of secrets) {
    if (secret) redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadOnePasswordEnvironment(
  options: LoadOnePasswordEnvironmentOptions = {}
): Promise<Map<string, string>> {
  const env = options.env ?? process.env;
  const environmentId = readEnv(env, "OP_ENVIRONMENT_ID");
  const serviceAccountToken = readEnv(env, "OP_SERVICE_ACCOUNT_TOKEN");

  if (!environmentId && !serviceAccountToken) return new Map();
  if (!environmentId) {
    throw new Error("OP_ENVIRONMENT_ID is required when OP_SERVICE_ACCOUNT_TOKEN is set");
  }
  if (!serviceAccountToken) {
    throw new Error("OP_SERVICE_ACCOUNT_TOKEN is required when OP_ENVIRONMENT_ID is set");
  }

  const createClientImpl =
    options.createClientImpl ??
    (await (options.loadSdkImpl ?? (async () => import("@1password/sdk")))()).createClient;

  try {
    const client = (await createClientImpl({
      auth: serviceAccountToken,
      integrationName: "panos-mcp",
      integrationVersion: process.env.npm_package_version ?? "unknown",
    })) as OnePasswordClient;
    const response = await client.environments.getVariables(environmentId);
    const variables = new Map<string, string>();

    for (const variable of response.variables ?? []) {
      if (options.allowedNames && !options.allowedNames.has(variable.name)) continue;
      if (variable.name) variables.set(variable.name, variable.value ?? "");
    }

    return variables;
  } catch (error) {
    throw new Error(
      `[panos-mcp] Failed to load 1Password Environment: ${redact(
        errorMessage(error),
        [serviceAccountToken]
      )}`
    );
  }
}
