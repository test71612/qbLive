import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { serviceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  let query = serviceClient().from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (repo) {
    query = query.eq("repo", repo);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}
