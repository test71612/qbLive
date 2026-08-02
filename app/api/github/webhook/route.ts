import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logAuditEvent } from "@/lib/github";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (env.githubWebhookSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    const expected = `sha256=${crypto.createHmac("sha256", env.githubWebhookSecret).update(rawBody).digest("hex")}`;
    if (!signature || signature !== expected) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody) as {
    repository?: { full_name?: string };
    pusher?: { name?: string };
    after?: string;
  };

  await logAuditEvent({
    repo: payload.repository?.full_name ?? null,
    actor: payload.pusher?.name ?? "github",
    action: "push",
    target: payload.after?.slice(0, 7) ?? null,
  });

  return NextResponse.json({ status: "ok" });
}
