import { useRef, type PointerEvent } from "react";
import { Table } from "@tiptap/extension-table";
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Move, Maximize2, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GazetteTableFrame } from "@/components/GazetteTableFrame";
import { tableLayout } from "@/lib/gazette";
import { useI18n } from "@/lib/i18n";

type Mode = "move" | "resize" | "rotate";
function TableNode({ node, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const { lang } = useI18n();
  const fr = lang === "fr";
  const wrapper = useRef<HTMLDivElement>(null);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({ ...tableLayout(), x: 0, y: 0, distance: 0, angle: 0, mode: "move" as Mode });
  const pinched = useRef(false);
  const layout = tableLayout(node.attrs);
  const pair = () => {
    const [a, b] = [...points.current.values()];
    return a && b ? { distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI } : null;
  };
  const reset = (x: number, y: number, mode: Mode) => {
    const gesture = pair();
    start.current = { ...tableLayout(node.attrs), x, y, mode, distance: gesture?.distance ?? 0, angle: gesture?.angle ?? 0 };
  };
  function begin(e: PointerEvent<HTMLElement>, mode: Mode) {
    if (!editor.isEditable) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!points.current.size) pinched.current = false;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size > 1) pinched.current = true;
    reset(e.clientX, e.clientY, mode);
  }
  function move(e: PointerEvent<HTMLElement>) {
    if (!points.current.has(e.pointerId)) return;
    e.preventDefault();
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const initial = start.current, gesture = pair();
    const width = wrapper.current?.clientWidth ?? 300;
    if (gesture && initial.distance > 0) updateAttributes(tableLayout({ ...layout, width: initial.width * gesture.distance / initial.distance, rotation: ((initial.rotation + gesture.angle - initial.angle + 540) % 360) - 180 }));
    else if (initial.mode === "resize") updateAttributes(tableLayout({ ...layout, width: initial.width + (e.clientX - initial.x) / width * 100 }));
    else if (initial.mode === "rotate") updateAttributes(tableLayout({ ...layout, rotation: initial.rotation + (e.clientX - initial.x) * 0.5 }));
    else updateAttributes(tableLayout({ ...layout, offset: initial.offset + (e.clientX - initial.x) / Math.max(1, width * (100 - initial.width) / 100) * 100 }));
  }
  function end(e: PointerEvent<HTMLElement>, cancelled = false) {
    if (!points.current.delete(e.pointerId)) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const remaining = [...points.current.values()][0];
    if (remaining) { reset(remaining.x, remaining.y, start.current.mode); return; }
    if (cancelled || pinched.current || start.current.mode !== "move" || Math.abs(e.clientY - start.current.y) < 30) return;
    const from = getPos(), target = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (typeof from !== "number" || !target || (target.pos >= from && target.pos <= from + node.nodeSize)) return;
    // Insert at a top-level block boundary, never inside a paragraph or another table.
    const resolved = editor.state.doc.resolve(target.pos);
    const to = resolved.depth ? (e.clientY < start.current.y ? resolved.before(1) : resolved.after(1)) : target.pos;
    const current = editor.state.doc.nodeAt(from);
    if (!current || (to >= from && to <= from + current.nodeSize)) return;
    const tr = editor.state.tr.delete(from, from + current.nodeSize);
    tr.insert(tr.mapping.map(to), current);
    editor.view.dispatch(tr.scrollIntoView());
  }
  const handlers = (mode: Mode) => ({ onPointerDown: (e: PointerEvent<HTMLElement>) => begin(e, mode), onPointerMove: move, onPointerUp: (e: PointerEvent<HTMLElement>) => end(e), onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, true) });
  return <NodeViewWrapper className="gazette-table-node">
    <div ref={wrapper}>
      {editor.isEditable && <div className="gazette-table-controls" contentEditable={false} role="toolbar" aria-label={fr ? "Modifier le tableau" : "Edit table"}>
        {([["move", Move, fr ? "Déplacer le tableau" : "Move table"], ["resize", Maximize2, fr ? "Redimensionner le tableau" : "Resize table"], ["rotate", RotateCw, fr ? "Tourner le tableau" : "Rotate table"]] as const).map(([mode, Icon, label]) => <Button key={mode} type="button" variant="secondary" size="icon" title={label} aria-label={label} className="gazette-image-touch" {...handlers(mode)}><Icon /></Button>)}
        <Button type="button" variant="secondary" size="icon" title={fr ? "Supprimer le tableau" : "Delete table"} aria-label={fr ? "Supprimer ce tableau" : "Delete this table"} onClick={deleteNode}><Trash2 /></Button>
      </div>}
      <GazetteTableFrame attrs={node.attrs}><NodeViewContent as="table" /></GazetteTableFrame>
    </div>
  </NodeViewWrapper>;
}

export const GazetteTable = Table.extend({
  addAttributes() { return { ...this.parent?.(), width: { default: 100 }, offset: { default: 0 }, rotation: { default: 0 } }; },
  addNodeView() { return ReactNodeViewRenderer(TableNode, { contentDOMElementTag: "tbody" }); },
}).configure({ resizable: false });