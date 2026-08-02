import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ops-hub-secret");
  if (!env.graphIngestSecret || secret !== env.graphIngestSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    repo?: string;
    graph?: Record<string, string[]>;
    commitSha?: string | null;
  };

  if (!body.repo || !body.graph) {
    return NextResponse.json({ error: "repo and graph are required" }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("dep_graphs")
    .upsert({
      repo: body.repo,
      graph: body.graph,
      commit_sha: body.commitSha ?? null,
      generated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ graph: data });
}
