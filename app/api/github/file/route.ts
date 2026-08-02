import { NextRequest, NextResponse } from "next/server";
import { fetchFile } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  const filePath = request.nextUrl.searchParams.get("path");
  if (!repo || !filePath) {
    return NextResponse.json({ error: "repo and path are required" }, { status: 400 });
  }

  try {
    const file = await fetchFile(user.accessToken, repo, filePath);
    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "github_error" }, { status: 500 });
  }
}
