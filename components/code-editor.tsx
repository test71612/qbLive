"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
  const editorRef = useRef<{ setPosition: (position: { lineNumber: number; column: number }) => void; revealLineInCenter: (lineNumber: number) => void; setScrollTop: (value: number) => void } | null>(null);

  function resetToFirstLine() {
    window.requestAnimationFrame(() => {
      editorRef.current?.setScrollTop(0);
      editorRef.current?.setPosition({ lineNumber: 1, column: 1 });
      editorRef.current?.revealLineInCenter(1);
    });
  }

  useEffect(() => {
    resetToFirstLine();
  }, [path]);

  return (
    <div className={fullscreen ? "code-editor-fullscreen" : "code-editor"}>
      <div className="code-editor-bar"><span>{path}</span><button type="button" onClick={() => setFullscreen((current) => !current)}>{fullscreen ? "تصغير المحرر" : "تكبير المحرر"}</button></div>
      <MonacoEditor
        key={path}
        path={path}
        height={fullscreen ? "calc(100vh - 64px)" : "52vh"}
        language={languageFor(path)}
        theme="vs-dark"
        value={value}
        saveViewState={false}
        onMount={(editor) => {
          editorRef.current = editor;
          resetToFirstLine();
        }}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: "on", wordWrap: "on", automaticLayout: true, padding: { top: 14, bottom: 14 }, scrollBeyondLastLine: false }}
      />
    </div>
  );
}
