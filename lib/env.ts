import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const configuredAdmins = optional("ADMIN_GITHUB_USERNAMES")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// The first historical admin remains the safe fallback, so existing installs
// keep working until OWNER_GITHUB_USERNAME is explicitly set.
const configuredOwner = optional("OWNER_GITHUB_USERNAME", configuredAdmins[0] ?? "").trim();

function inferDefaultRepo(): string {
  const explicit = optional("DEFAULT_REPO", "").trim();
  if (explicit) {
    return explicit;
  }

  const githubRepo = optional("GITHUB_REPOSITORY", "").trim();
  if (githubRepo) {
    return githubRepo;
  }

  const owner = optional("VERCEL_GIT_REPO_OWNER", "").trim();
  const slug = optional("VERCEL_GIT_REPO_SLUG", "").trim();
  if (owner && slug) {
    return `${owner}/${slug}`;
  }

  return "";
}

export function getAppBaseUrl(requestUrl?: string) {
  if (requestUrl) {
    return new URL(requestUrl).origin;
  }

  const configured = optional("APP_URL", "").trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured;
    }
  }

  return "http://localhost:3000";
}

export const env = {
  appUrl: optional("APP_URL", "http://localhost:3000"),
  sessionSecret: required("SESSION_SECRET"),
  githubClientId: required("GITHUB_CLIENT_ID"),
  githubClientSecret: required("GITHUB_CLIENT_SECRET"),
  githubWebhookSecret: optional("GITHUB_WEBHOOK_SECRET"),
  graphIngestSecret: optional("GRAPH_INGEST_SECRET"),
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  defaultRepo: inferDefaultRepo(),
  adminGitHubUsernames: configuredAdmins,
  ownerGitHubUsername: configuredOwner,
  lockIdleHours: Number(optional("LOCK_IDLE_HOURS", "3")),
  aiApiKey: optional("AI_API_KEY"),
  aiBaseUrl: optional("AI_BASE_URL", "https://openrouter.ai/api/v1"),
  aiModel: optional("AI_MODEL", "openrouter/free"),
};
