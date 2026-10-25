export const PAPER_THEMES = ["paper", "night", "mint", "rose"] as const;
export type PaperTheme = typeof PAPER_THEMES[number];
export const INK_COLORS = ["var(--gazette-ink)", "var(--gazette-red)", "var(--gazette-green)", "var(--gazette-blue)", "var(--gazette-gold)"];
export const GAZETTE_FONTS = ["Georgia", "Arial", "Courier New"];
export type GazetteNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: GazetteNode[] };
export function imageLayout(attrs?: Record<string, unknown>) {
  const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return { width: bounded(attrs?.width, 100, 15, 100), offset: bounded(attrs?.offset, 0, 0, 100), rotation: bounded(attrs?.rotation, 0, -180, 180) };
}
export function gazetteTitle(value: unknown): string {
  const title = cleanGazette(value)?.attrs?.title;
  return typeof title === "string" ? title : "";
}
const nodes = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "hardBreak", "table", "tableRow", "tableHeader", "tableCell", "image"]);
export function cleanGazette(value: unknown): GazetteNode | null {
  let count = 0;
  function visit(raw: unknown, depth: number): GazetteNode | null {
    if (!raw || typeof raw !== "object" || depth > 12 || ++count > 1500) return null;
    const n = raw as GazetteNode;
    if (!nodes.has(n.type)) return null;
    const attrs: Record<string, unknown> = {};
    if (n.type === "doc" && typeof n.attrs?.title === "string") attrs.title = n.attrs.title.trim().slice(0, 200);
    if (n.type === "image") {
      const path = n.attrs?.storagePath;
      if (typeof path !== "string" || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(path)) return null;
      attrs.storagePath = path;
      attrs.alt = typeof n.attrs?.alt === "string" ? n.attrs.alt.slice(0, 200) : "";
      Object.assign(attrs, imageLayout(n.attrs));
    }
    if (n.type === "heading") attrs.level = [1, 2, 3].includes(Number(n.attrs?.level)) ? Number(n.attrs?.level) : 2;
    if (["left", "center", "right", "justify"].includes(String(n.attrs?.textAlign))) attrs.textAlign = n.attrs?.textAlign;
    const marks = (Array.isArray(n.marks) ? n.marks : []).flatMap((m) => {
      if (["bold", "italic", "underline", "strike", "code"].includes(m.type)) return [{ type: m.type }];
      if (m.type !== "textStyle") return [];
      const a: Record<string, unknown> = {};
      if (INK_COLORS.includes(String(m.attrs?.color))) a.color = m.attrs?.color;
      if (GAZETTE_FONTS.includes(String(m.attrs?.fontFamily))) a.fontFamily = m.attrs?.fontFamily;
      return [{ type: m.type, attrs: a }];
    });
    return { type: n.type, ...(n.type === "text" ? { text: String(n.text ?? "").slice(0, 5000) } : {}), attrs, marks, content: (Array.isArray(n.content) ? n.content : []).flatMap((c) => { const child = visit(c, depth + 1); return child ? [child] : []; }) };
  }
  const doc = visit(value, 0);
  return doc?.type === "doc" ? doc : null;
}
export function gazettePaths(doc: GazetteNode | null): string[] {
  if (!doc) return [];
  return [...new Set([...(doc.type === "image" && typeof doc.attrs?.storagePath === "string" ? [doc.attrs.storagePath] : []), ...(doc.content ?? []).flatMap(gazettePaths)])];
}