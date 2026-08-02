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
  defaultRepo: optional("DEFAULT_REPO"),
  adminGitHubUsernames: optional("ADMIN_GITHUB_USERNAMES")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  lockIdleHours: Number(optional("LOCK_IDLE_HOURS", "3")),
};
