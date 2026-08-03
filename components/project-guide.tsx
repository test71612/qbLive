"use client";

import { useState } from "react";

export function ProjectGuide({ repo, path }: { repo: string; path: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(nextQuestion = question) {
    if (!nextQuestion.trim()) return;
    setLoading(true);
    setAnswer("");
    const response = await fetch("/api/ai/guide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo, path, question: nextQuestion }),
    });
    const payload = (await response.json()) as { answer?: string; error?: string; reason?: string };
    setAnswer(payload.answer ?? (payload.error === "ai_not_configured" ? "أضف AI_API_KEY في Vercel لتفعيل المساعد." : payload.reason ?? "تعذر الوصول إلى المساعد الآن."));
    setLoading(false);
  }

  return (
    <section className="guide-card">
      <div><p className="guide-kicker">مرشد المشروع</p><h3>اسأل قبل أن تعدّل</h3><p>يقرأ الملف المحدد ويقترح عليك الخطوة التالية بلغة بسيطة.</p></div>
      <div className="guide-prompts">
        {["ما وظيفة هذا الملف؟", "ما الملفات التي يجب أن أراجعها معه؟", "اقترح أول خطوة آمنة للتعديل"].map((prompt) => <button key={prompt} onClick={() => void ask(prompt)}>{prompt}</button>)}
      </div>
      <div className="guide-input"><input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="مثال: أين أبدأ لإصلاح هذه الصفحة؟" /><button className="btn-primary" onClick={() => void ask()} disabled={loading}>{loading ? "يفكر..." : "اسأل"}</button></div>
      {answer && <div className="guide-answer whitespace-pre-wrap">{answer}</div>}
    </section>
  );
}
