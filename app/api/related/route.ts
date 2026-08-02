import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";
import type { RelatedFileResult } from "@/lib/types";

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

  const db = serviceClient();
  const { data: graphRow, error: graphError } = await db.from("dep_graphs").select("graph").eq("repo", repo).maybeSingle();
  if (graphError) {
    return NextResponse.json({ error: graphError.message }, { status: 500 });
  }

  const graph = (graphRow?.graph ?? {}) as Record<string, string[]>;
  const imports = graph[filePath] ?? [];
  const importedBy = Object.entries(graph)
    .filter(([, targets]) => targets.includes(filePath))
    .map(([source]) => source);

  const { data: manualRows, error: manualError } = await db
    .from("related_files")
    .select("file_path, related_path")
    .eq("repo", repo)
    .or(`file_path.eq.${filePath},related_path.eq.${filePath}`);

  if (manualError) {
    return NextResponse.json({ error: manualError.message }, { status: 500 });
  }

  const manual = (manualRows ?? []).map((row) => (row.file_path === filePath ? row.related_path : row.file_path));
  const result: RelatedFileResult = { imports, importedBy, manual };

  return NextResponse.json(result);
}
