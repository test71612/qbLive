"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProjectMapProps = { repo: string };
type Graph = Record<string, string[]>;

function category(path: string) {
  if (/(^|\/)app\/.+\/page\.(t|j)sx?$|(^|\/)pages\//.test(path)) return "page";
  if (path.includes("/components/") || path.startsWith("components/")) return "component";
  return "file";
}

export function ProjectMap({ repo }: ProjectMapProps) {
  const [graph, setGraph] = useState<Graph>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/graph?repo=${encodeURIComponent(repo)}`)
      .then((response) => response.json())
      .then((payload: { graph?: Graph }) => setGraph(payload.graph ?? {}))
      .finally(() => setLoading(false));
  }, [repo]);

  const pages = useMemo(() => Object.keys(graph).filter((path) => category(path) === "page").slice(0, 18), [graph]);

  if (loading) return <p className="muted">جارٍ تجهيز خريطة المشروع...</p>;
  if (!Object.keys(graph).length) return <section className="map-empty"><h2>الخريطة بانتظار أول تحليل</h2><p>شغّل GitHub Action الخاصة برسم الاعتمادات، وبعد أول push ستظهر العلاقات بين الصفحات والمكونات والملفات هنا.</p><Link href="/explorer" className="btn-primary">افتح المستكشف الآن</Link></section>;

  return (
    <div className="map-board">
      <section className="map-hero"><p>QB TEAM · PROJECT MAP</p><h1>افهم المشروع قبل أن تطلب من الذكاء الاصطناعي التعديل</h1><span>{Object.keys(graph).length} ملف محلّل · {pages.length} صفحة رئيسية</span></section>
      <section className="map-legend"><span className="map-page-dot">صفحة</span><span className="map-component-dot">مكوّن</span><span className="map-file-dot">ملف / خدمة</span></section>
      <div className="map-flow">
        {pages.map((page) => {
          const direct = graph[page] ?? [];
          const components = direct.filter((path) => category(path) === "component").slice(0, 6);
          const files = direct.filter((path) => category(path) !== "component").slice(0, 5);
          return <article key={page} className="map-route"><div className="map-node map-page"><Link href={`/explorer?path=${encodeURIComponent(page)}`}>{page}</Link><a href={`https://github.com/${repo}/blob/HEAD/${page}`} target="_blank" rel="noreferrer">GitHub ↗</a></div><div className="map-arrow">↓</div><div className="map-targets">{components.map((path) => <Link key={path} className="map-node map-component" href={`/explorer?path=${encodeURIComponent(path)}`}>{path}</Link>)}{files.map((path) => <Link key={path} className="map-node map-file" href={`/explorer?path=${encodeURIComponent(path)}`}>{path}</Link>)}{!direct.length && <p className="map-none">لا توجد روابط مباشرة مسجلة بعد.</p>}</div></article>;
        })}
      </div>
    </div>
  );
}
