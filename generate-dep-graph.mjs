#!/usr/bin/env node
/**
 * Builds the import graph for a repo and sends it to the Ops Hub.
 *
 * Why it lives outside the web app: a serverless function can't clone the
 * target repository, and a build container would cost money. Running madge
 * here (or in the GitHub Action in dep-graph.yml) keeps the whole thing
 * on free tiers.
 *
 * Usage:
 *   node generate-dep-graph.mjs --dir ../streamer-platform --repo owner/name
 *   node generate-dep-graph.mjs --dir . --repo owner/name --out graph.json
 *
 * Environment: OPS_HUB_URL, GRAPH_INGEST_SECRET
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import madge from "madge";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1]]);
    return acc;
  }, []),
);

const dir = path.resolve(args.dir ?? ".");
const repo = args.repo;
const hubUrl = (args.url ?? process.env.OPS_HUB_URL ?? "").replace(/\/$/, "");
const secret = args.secret ?? process.env.GRAPH_INGEST_SECRET;

if (!repo) {
  console.error('Missing --repo "owner/name"');
  process.exit(1);
}

const result = await madge(dir, {
  fileExtensions: ["js", "jsx", "ts", "tsx", "mjs", "cjs"],
  excludeRegExp: [/node_modules/, /\.next/, /dist/, /build/, /\.test\./, /\.spec\./],
  tsConfig: path.join(dir, "tsconfig.json"),
  detectiveOptions: { ts: { skipTypeImports: false } },
});

// madge returns paths relative to `dir`, which is what the explorer uses too.
const graph = result.obj();
const files = Object.keys(graph).length;
console.log(`Mapped ${files} files in ${dir}`);

if (args.out) {
  await writeFile(args.out, JSON.stringify(graph, null, 2));
  console.log(`Wrote ${args.out}`);
}

if (hubUrl && secret) {
  const res = await fetch(`${hubUrl}/api/graph/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ops-hub-secret": secret },
    body: JSON.stringify({ repo, graph, commitSha: process.env.GITHUB_SHA ?? null }),
  });
  console.log(res.ok ? `Sent to ${hubUrl}` : `Ops Hub rejected the graph: ${res.status} ${await res.text()}`);
} else if (!args.out) {
  console.log(JSON.stringify(graph, null, 2));
}
