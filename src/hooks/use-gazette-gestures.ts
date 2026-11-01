import { useRef, useState, type PointerEvent } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { imageLayout } from "@/lib/gazette";
import { gesturePair, gestureLayout, type GesturePoint } from "@/lib/gazette-gestures";

type Mode = "move" | "resize" | "rotate";
export function useGazetteGestures({ node, editor, getPos, updateAttributes }: Pick<NodeViewProps, "node" | "editor" | "getPos" | "updateAttributes">, disabled = false) {
  const surface = useRef<HTMLDivElement>(null);
  const points = useRef(new Map<number, GesturePoint>());
  const [dragY, setDragY] = useState(0);
  const shift = useRef(0);
  const active = useRef(false);
  const dropY = useRef(0);
  const start = useRef({ ...imageLayout(node.attrs), x: 0, y: 0, distance: 0, angle: 0, paperWidth: 300, baseY: 0, mode: "move" as Mode });
  function reset(point: GesturePoint, mode: Mode) {
    const pair = gesturePair([...points.current.values()]);
    start.current = { ...imageLayout(node.attrs), ...(pair ?? point), distance: pair?.distance ?? 0, angle: pair?.angle ?? 0, paperWidth: surface.current?.closest(".gazette-prose")?.clientWidth ?? 300, baseY: shift.current, mode };
  }
  function begin(e: PointerEvent<HTMLDivElement | HTMLButtonElement>, mode: Mode, direct: boolean) {
    if (!editor.isEditable || disabled || (direct && (e.target as HTMLElement).closest("button, input"))) return;
    if (!points.current.size) { shift.current = 0; active.current = false; }
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // A single table touch still places the caret; two touches manipulate the object.
    if (!direct || node.type.name === "image" || points.current.size > 1) {
      active.current = true;
      e.preventDefault(); e.stopPropagation();
      for (const id of points.current.keys()) e.currentTarget.setPointerCapture(id);
      if (node.type.name === "image") { const pos = getPos(); if (typeof pos === "number") editor.commands.setNodeSelection(pos); }
    }
    reset({ x: e.clientX, y: e.clientY }, mode);
  }
  function move(e: PointerEvent<HTMLDivElement | HTMLButtonElement>) {
    if (!points.current.has(e.pointerId)) return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!active.current) return;
    e.preventDefault(); e.stopPropagation();
    const initial = start.current, pair = gesturePair([...points.current.values()]);
    const point = pair ?? { x: e.clientX, y: e.clientY };
    dropY.current = point.y;
    const dx = point.x - initial.x;
    if (pair && initial.distance > 0) updateAttributes(gestureLayout(initial, initial.paperWidth, dx, pair.distance / initial.distance, pair.angle - initial.angle));
    else if (initial.mode === "resize") updateAttributes(imageLayout({ ...initial, width: initial.width + dx / initial.paperWidth * 100 }));
    else if (initial.mode === "rotate") updateAttributes(gestureLayout(initial, initial.paperWidth, 0, 1, dx * 0.5));
    else updateAttributes(gestureLayout(initial, initial.paperWidth, dx));
    if (pair || initial.mode === "move") { shift.current = initial.baseY + point.y - initial.y; setDragY(shift.current); }
  }
  function end(e: PointerEvent<HTMLDivElement | HTMLButtonElement>, cancelled = false) {
    if (!points.current.delete(e.pointerId)) return;
    if (active.current) { e.preventDefault(); e.stopPropagation(); }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const remaining = [...points.current.values()][0];
    if (remaining) { reset(remaining, start.current.mode); return; }
    const dy = shift.current;
    setDragY(0); shift.current = 0;
    if (!cancelled && active.current && Math.abs(dy) > 30) {
      const from = getPos();
      // Find a top-level drop boundary using unshifted blocks, not transformed cells.
      if (typeof from === "number") {
        let to = 0;
        editor.state.doc.forEach((block, pos) => {
          if (pos === from) return;
          const dom = editor.view.nodeDOM(pos);
          if (!(dom instanceof HTMLElement)) return;
          const rect = dom.getBoundingClientRect();
          if (dropY.current >= rect.top + rect.height / 2) to = pos + block.nodeSize;
        });
        const current = editor.state.doc.nodeAt(from);
        if (current && (to < from || to > from + current.nodeSize)) {
          const tr = editor.state.tr.delete(from, from + current.nodeSize);
          tr.insert(tr.mapping.map(to), current); editor.view.dispatch(tr);
        }
      }
    }
    active.current = false;
  }
  const handlers = (mode: Mode, direct = false) => ({ onPointerDownCapture: (e: PointerEvent<HTMLDivElement | HTMLButtonElement>) => begin(e, mode, direct), onPointerMoveCapture: move, onPointerUpCapture: (e: PointerEvent<HTMLDivElement | HTMLButtonElement>) => end(e), onPointerCancelCapture: (e: PointerEvent<HTMLDivElement | HTMLButtonElement>) => end(e, true), onLostPointerCapture: (e: PointerEvent<HTMLDivElement | HTMLButtonElement>) => end(e, true) });
  return { surface, dragY, handlers };
}