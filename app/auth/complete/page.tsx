"use client";

import { useEffect, useState } from "react";

export default function CompleteAuthPage() {
  const [message, setMessage] = useState("جارٍ إكمال تسجيل الدخول...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const session = params.get("session");
    window.history.replaceState(null, "", "/auth/complete");

    if (!session) {
      window.location.replace("/?error=invalid_session_handoff");
      return;
    }

    void fetch("/api/auth/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session }),
    }).then(async (response) => {
      const payload = (await response.json()) as { token?: string };
      if (response.ok && payload.token) {
        window.localStorage.setItem("ops_hub_session", payload.token);
        window.location.replace("/dashboard");
      } else {
        setMessage("تعذر إكمال تسجيل الدخول. يرجى المحاولة مرة أخرى.");
      }
    });
  }, []);

  return <main className="shell flex flex-1 items-center justify-center"><p className="card p-6 text-sm muted">{message}</p></main>;
}
