import { createElement, type ReactNode, type CSSProperties } from "react";
import { cleanGazette, imageLayout, type GazetteNode } from "@/lib/gazette";
import { GazetteImage } from "@/components/GazetteImage";

export function GazetteContent({ document, images = {} }: { document: unknown; images?: Record<string, string> }) {
  const doc = cleanGazette(document);
  function render(n: GazetteNode, key: number): ReactNode {
    if (n.type === "text") {
      let text: ReactNode = n.text;
      for (const m of n.marks ?? []) {
        const tag = ({ bold: "strong", italic: "em", underline: "u", strike: "s", code: "code" } as Record<string, string>)[m.type] ?? "span";
        // Only allowlisted author-selected font/color tokens reach styles.
        text = createElement(tag, { style: m.type === "textStyle" ? m.attrs as CSSProperties : undefined }, text);
      }
      return <span key={key}>{text}</span>;
    }
    if (n.type === "image") {
      const url = images[String(n.attrs?.storagePath)];
      const layout = imageLayout(n.attrs);
      return url ? <figure key={key} className="gazette-image" style={{ width: `${layout.width}%`, marginLeft: `${(100 - layout.width) * layout.offset / 100}%` }}><GazetteImage src={url} alt={String(n.attrs?.alt ?? "")} attrs={n.attrs} /></figure> : null;
    }
    const tag = ({ paragraph: "p", heading: `h${n.attrs?.level ?? 2}`, bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", horizontalRule: "hr", hardBreak: "br", table: "table", tableRow: "tr", tableHeader: "th", tableCell: "td" } as Record<string, string>)[n.type] ?? "div";
    const children = n.content?.map(render);
    return createElement(tag, { key, style: n.attrs?.textAlign ? { textAlign: n.attrs.textAlign as CSSProperties["textAlign"] } : undefined }, tag === "table" ? <tbody>{children}</tbody> : tag === "hr" || tag === "br" ? undefined : children);
  }
  return <div className="gazette-prose">{doc?.content?.map(render)}</div>;
}