import { env } from "@/lib/env";
import { listConnectedRepos } from "@/lib/github";
import { getSession, getSessionUser } from "@/lib/session";
import type { RepoRecord } from "@/lib/types";

export async function getShellData() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, repos: [], currentRepo: "" };
  }

  const session = await getSession();
  const repos = (await listConnectedRepos()) as RepoRecord[];
  const preferredRepo = session.repo || env.defaultRepo || repos[0]?.repo || "";

  if (preferredRepo && !session.repo) {
    session.repo = preferredRepo;
    await session.save();
  }

  return { user, repos, currentRepo: preferredRepo };
}
