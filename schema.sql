-- Ops Hub schema. Run this once in Supabase > SQL Editor.
-- Design note: the browser only ever uses the ANON key and only READS.
-- Every write goes through a Next.js API route using the SERVICE ROLE key,
-- which is where identity (GitHub OAuth session) and permissions are checked.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- people
create table if not exists app_users (
  github_username text primary key,
  display_name    text,
  avatar_url      text,
  role            text not null default 'member', -- member | admin
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- repos
create table if not exists repos (
  repo        text primary key,             -- "owner/name"
  label       text,
  added_by    text references app_users(github_username),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- locks
create table if not exists file_locks (
  id                        uuid primary key default gen_random_uuid(),
  repo                      text not null,
  file_paths                text[] not null,
  locked_by_github_username text not null,
  reason                    text not null,
  created_at                timestamptz not null default now(),
  last_active_at            timestamptz not null default now(),
  released_at               timestamptz,
  released_by               text
);
create index if not exists file_locks_active_idx on file_locks (repo) where released_at is null;

-- ------------------------------------------------------- plain-language notes
create table if not exists file_notes (
  repo        text not null,
  file_path   text not null,
  note        text not null,
  updated_by  text not null,
  updated_at  timestamptz not null default now(),
  primary key (repo, file_path)
);

-- ---------------------------------------------------------------- tasks
create table if not exists tasks (
  id                        uuid primary key default gen_random_uuid(),
  repo                      text not null,
  title                     text not null,
  status                    text not null default 'todo', -- todo | in_progress | done
  file_paths                text[] default '{}',
  created_by_github_username text not null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ------------------------------------------------- dependency graph cache
-- Produced by scripts/generate-dep-graph.mjs (locally or from a GitHub Action)
-- and posted to /api/graph/ingest. Shape: { "src/a.ts": ["src/b.ts", ...] }
create table if not exists dep_graphs (
  repo         text primary key,
  graph        jsonb not null,
  commit_sha   text,
  generated_at timestamptz not null default now()
);

-- Manual fallback for files the static graph can't see (images, SQL, configs).
create table if not exists related_files (
  id           uuid primary key default gen_random_uuid(),
  repo         text not null,
  file_path    text not null,
  related_path text not null,
  note         text,
  created_by   text not null,
  created_at   timestamptz not null default now(),
  unique (repo, file_path, related_path)
);

-- Friendly labels/groups for the visual map when auto-detection guesses wrong.
create table if not exists map_overrides (
  repo       text not null,
  file_path  text not null,
  label      text,
  tier       text, -- page | component | file
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (repo, file_path)
);

-- ------------------------------------------------------------- audit log
create table if not exists audit_log (
  id         bigint generated always as identity primary key,
  repo       text,
  actor      text,
  action     text not null,  -- claim | release | force_release | push | task_move | note_edit
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

-- ------------------------------------------------------------------ RLS
-- Read-only for the browser (anon), everything else denied. Service role
-- bypasses RLS, so the API routes keep full access.
alter table app_users     enable row level security;
alter table repos         enable row level security;
alter table file_locks    enable row level security;
alter table file_notes    enable row level security;
alter table tasks         enable row level security;
alter table dep_graphs    enable row level security;
alter table related_files enable row level security;
alter table map_overrides enable row level security;
alter table audit_log     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['app_users','repos','file_locks','file_notes','tasks',
                           'dep_graphs','related_files','map_overrides','audit_log']
  loop
    execute format('drop policy if exists read_all on %I', t);
    execute format('create policy read_all on %I for select using (true)', t);
  end loop;
end $$;

-- ------------------------------------------------------------- realtime
-- Lets every open tab see claims/tasks/notes change without a refresh.
alter publication supabase_realtime add table file_locks;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table file_notes;
