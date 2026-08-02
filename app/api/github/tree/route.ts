import { NextRequest, NextResponse } from "next/server";
import { fetchRepoTree } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  if (!repo) {
    return NextResponse.json({ error: "repo is required" }, { status: 400 });
  }

  try {
    const tree = await fetchRepoTree(user.accessToken, repo);
    return NextResponse.json({ tree });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "github_error" }, { status: 500 });
  }
}
