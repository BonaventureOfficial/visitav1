import { useRef, useState, type PointerEvent } from "react";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Move, RotateCw, Maximize2, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GazetteImage } from "@/components/GazetteImage";
import { imageLayout } from "@/lib/gazette";
import { uploadPostImage, PHOTO_TYPES } from "@/lib/posts";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

type Mode = "move" | "resize" | "rotate";
function ImageNode({ node, editor, extension, getPos, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { lang } = useI18n(); const fr = lang === "fr";
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({ x: 0, y: 0, width: 100, offset: 0, rotation: 0, distance: 0, angle: 0, mode: "move" as Mode });
  const layout = imageLayout(node.attrs);
  const pair = () => {
    const [a, b] = [...points.current.values()];
    return a && b ? { distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI } : null;
  };
  function begin(e: PointerEvent<HTMLElement>, mode: Mode) {
    if (!editor.isEditable || busy) return;
    e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPos(); if (typeof pos === "number") editor.commands.setNodeSelection(pos);
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = pair();
    start.current = { ...layout, x: e.clientX, y: e.clientY, distance: gesture?.distance ?? 0, angle: gesture?.angle ?? 0, mode };
  }
  function move(e: PointerEvent<HTMLElement>) {
    if (!points.current.has(e.pointerId)) return;
    e.preventDefault(); points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const initial = start.current, gesture = pair();
    const paperWidth = frame.current?.parentElement?.clientWidth ?? 300;
    if (gesture && initial.distance > 0) {
      updateAttributes({ width: Math.min(100, Math.max(15, initial.width * gesture.distance / initial.distance)), rotation: ((initial.rotation + gesture.angle - initial.angle + 540) % 360) - 180 });
    } else if (initial.mode === "resize") updateAttributes({ width: Math.min(100, Math.max(15, initial.width + (e.clientX - initial.x) / paperWidth * 100)) });
    else if (initial.mode === "rotate") updateAttributes({ rotation: Math.min(180, Math.max(-180, initial.rotation + (e.clientX - initial.x) * 0.5)) });
    else updateAttributes({ offset: Math.min(100, Math.max(0, initial.offset + (e.clientX - initial.x) / Math.max(1, paperWidth * (100 - initial.width) / 100) * 100)) });
  }
  function end(e: PointerEvent<HTMLElement>, cancelled = false) {
    const wasPinch = points.current.size > 1 || start.current.distance > 0;
    if (!points.current.delete(e.pointerId)) return;
    if (points.current.size) return;
    if (!cancelled && !wasPinch && start.current.mode === "move" && Math.abs(e.clientY - start.current.y) > 30) {
      const from = getPos(), target = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (typeof from === "number" && target && (target.pos < from || target.pos > from + node.nodeSize)) {
        const current = editor.state.doc.nodeAt(from);
        if (current) {
          const tr = editor.state.tr.delete(from, from + current.nodeSize);
          tr.insert(tr.mapping.map(target.pos), current);
          editor.view.dispatch(tr.scrollIntoView());
        }
      }
    }
  }
  const handlers = (mode: Mode) => ({ onPointerDown: (e: PointerEvent<HTMLElement>) => begin(e, mode), onPointerMove: move, onPointerUp: (e: PointerEvent<HTMLElement>) => end(e), onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, true) });
  return <NodeViewWrapper className="gazette-image-node" contentEditable={false}>
    <div ref={frame} className={`gazette-image ${selected ? "gazette-image-selected" : ""}`} style={{ width: `${layout.width}%`, marginLeft: `${(100 - layout.width) * layout.offset / 100}%` }}>
      <div className="gazette-image-touch" {...handlers("move")}><GazetteImage src={String(node.attrs.src ?? "")} alt={String(node.attrs.alt ?? "")} attrs={node.attrs} /></div>
    </div>
    {selected && <div className="gazette-image-controls" role="toolbar" aria-label={fr ? "Modifier la photo" : "Edit photo"}>
      {([ ["move", Move, fr ? "Déplacer" : "Move"], ["resize", Maximize2, fr ? "Redimensionner" : "Resize"], ["rotate", RotateCw, fr ? "Tourner" : "Rotate"] ] as const).map(([mode, Icon, label]) => <Button key={mode} type="button" variant="secondary" size="icon" title={label} aria-label={label} className="gazette-image-touch" disabled={busy} {...handlers(mode)}><Icon /></Button>)}
      <Button type="button" variant="secondary" size="icon" title={fr ? "Remplacer" : "Replace"} aria-label={fr ? "Remplacer la photo" : "Replace photo"} disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}</Button>
      <Button type="button" variant="secondary" size="icon" title={fr ? "Supprimer" : "Delete"} aria-label={fr ? "Supprimer la photo" : "Delete photo"} disabled={busy} onClick={deleteNode}><Trash2 /></Button>
    </div>}
    <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} className="sr-only" aria-label={fr ? "Photo de remplacement" : "Replacement photo"} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ""; if (!file || busy) return;
      setBusy(true);
      try {
        const image = await uploadPostImage(extension.options.userId, file);
        if (typeof getPos() === "number") { updateAttributes({ src: image.url, storagePath: image.path, alt: file.name }); extension.options.onUploaded(image); }
      } catch (error) { toast.error(error instanceof Error ? error.message : (fr ? "Photo impossible" : "Could not replace photo")); }
      finally { setBusy(false); }
    }} />
  </NodeViewWrapper>;
}
export const StoredImage = Image.extend<{ userId: string; onUploaded: (image: { path: string; url: string }) => void }>({
  addOptions() { return { ...this.parent?.(), userId: "", onUploaded: () => {} }; },
  addAttributes() { return { ...this.parent?.(), storagePath: { default: null }, width: { default: 70 }, offset: { default: 50 }, rotation: { default: 0 } }; },
  addNodeView() { return ReactNodeViewRenderer(ImageNode); },
});
