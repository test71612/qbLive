import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = request.nextUrl.searchParams.get("repo");
  if (!repo) return NextResponse.json({ error: "repo is required" }, { status: 400 });

  const { data, error } = await serviceClient().from("dep_graphs").select("graph, commit_sha, generated_at").eq("repo", repo).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ graph: data?.graph ?? {}, commitSha: data?.commit_sha ?? null, generatedAt: data?.generated_at ?? null });
}
