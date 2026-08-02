export type Role = "admin" | "member";

export type SessionUser = {
  login: string;
  name: string;
  avatarUrl: string;
  accessToken: string;
  role: Role;
};

export type RepoRecord = {
  repo: string;
  label: string | null;
  added_by: string | null;
  created_at: string;
};

export type FileLock = {
  id: string;
  repo: string;
  file_paths: string[];
  locked_by_github_username: string;
  reason: string;
  created_at: string;
  last_active_at: string;
  released_at: string | null;
  released_by: string | null;
};

export type FileNote = {
  repo: string;
  file_path: string;
  note: string;
  updated_by: string;
  updated_at: string;
};

export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  repo: string;
  title: string;
  status: TaskStatus;
  file_paths: string[];
  created_by_github_username: string;
  created_at: string;
  updated_at: string;
};

export type AuditEntry = {
  id: number;
  repo: string | null;
  actor: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type GitHubTreeNode = {
  path: string;
  type: "blob" | "tree";
};

export type GitHubFile = {
  path: string;
  content: string;
  sha: string;
};

export type GitHubCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

export type RelatedFileResult = {
  imports: string[];
  importedBy: string[];
  manual: string[];
};
