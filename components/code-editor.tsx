"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function languageFor(path: string) {
  if (/\.tsx?$/i.test(path)) return "typescript";
  if (/\.jsx?$/i.test(path)) return "javascript";
  if (/\.json$/i.test(path)) return "json";
  if (/\.css$/i.test(path)) return "css";
  if (/\.html$/i.test(path)) return "html";
  if (/\.md$/i.test(path)) return "markdown";
  if (/\.ya?ml$/i.test(path)) return "yaml";
  if (/\.sql$/i.test(path)) return "sql";
  return "plaintext";
}

export function CodeEditor({ path, value, onChange }: { path: string; value: string; onChange: (value: string) => void }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className={fullscreen ? "code-editor-fullscreen" : "code-editor"}>
      <div className="code-editor-bar"><span>{path}</span><button type="button" onClick={() => setFullscreen((current) => !current)}>{fullscreen ? "تصغير المحرر" : "تكبير المحرر"}</button></div>
      <MonacoEditor
        height={fullscreen ? "calc(100vh - 64px)" : "52vh"}
        language={languageFor(path)}
        theme="vs-dark"
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: "on", wordWrap: "on", automaticLayout: true, padding: { top: 14, bottom: 14 }, scrollBeyondLastLine: false }}
      />
    </div>
  );
}
