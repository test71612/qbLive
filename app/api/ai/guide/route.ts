import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { fetchFile } from "@/lib/github";
import { getSessionUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!env.aiApiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const body = (await request.json()) as { repo?: string; path?: string; question?: string };
  const repo = body.repo?.trim();
  const question = body.question?.trim();
  if (!repo || !question) return NextResponse.json({ error: "repo_and_question_required" }, { status: 400 });

  let fileContext = "لا يوجد ملف محدد.";
  if (body.path?.trim()) {
    try {
      const file = await fetchFile(user.accessToken, repo, body.path.trim());
      fileContext = `الملف: ${file.path}\n\n${file.content.slice(0, 12000)}`;
    } catch {
      fileContext = `الملف المحدد: ${body.path.trim()} (تعذر تحميل محتواه).`;
    }
  }

  const response = await fetch(`${env.aiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.aiApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.aiModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: "أنت مرشد مشروع برمجي. أجب بالعربية بشكل مختصر وعملي. لا تخمّن: اذكر ما تعرفه من الملف فقط، واقترح الملف أو الخطوة التالية." },
        { role: "user", content: `المستودع: ${repo}\n${fileContext}\n\nسؤال المطور: ${question}` },
      ],
    }),
  });

  if (!response.ok) return NextResponse.json({ error: "ai_request_failed" }, { status: 502 });
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return NextResponse.json({ answer: payload.choices?.[0]?.message?.content ?? "لم يصل رد من المساعد." });
}
