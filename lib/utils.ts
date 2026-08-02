export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function overlap(left: string[], right: string[]) {
  const set = new Set(right);
  return left.filter((item) => set.has(item));
}

export function parseRepo(value: string) {
  const [owner, repo] = value.split("/");
  if (!owner || !repo) {
    throw new Error("repo must be in owner/name format");
  }
  return { owner, repo };
}

export function formatRelativeDate(input: string) {
  const diff = Date.now() - new Date(input).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `قبل ${days} يوم`;
}

export function buildTree(paths: string[]) {
  const root = new Map<string, unknown>();

  for (const path of paths.sort()) {
    const parts = path.split("/");
    let cursor = root;
    parts.forEach((part, index) => {
      if (!cursor.has(part)) {
        cursor.set(part, index === parts.length - 1 ? null : new Map<string, unknown>());
      }
      const next = cursor.get(part);
      if (next instanceof Map) {
        cursor = next;
      }
    });
  }

  return root;
}

export function isTextPath(path: string) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|sql|yml|yaml|txt|env|html)$/i.test(path);
}

export function decodeBase64(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}
