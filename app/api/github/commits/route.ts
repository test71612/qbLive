import { NextRequest, NextResponse } from "next/server";
import { fetchCommits } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  const path = request.nextUrl.searchParams.get("path") ?? undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "8");
  if (!repo) {
    return NextResponse.json({ error: "repo is required" }, { status: 400 });
  }

  try {
    const commits = await fetchCommits(user.accessToken, repo, path, limit);
    return NextResponse.json({ commits });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "github_error" }, { status: 500 });
  }
}
