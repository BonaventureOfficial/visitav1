import { useEffect, useRef, useState, type ReactNode } from "react";
import { tableLayout } from "@/lib/gazette";

/** Measure untransformed content and reserve the entire rotated bounding box. */
export function GazetteTableFrame({ attrs, children }: { attrs?: Record<string, unknown>; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = tableLayout(attrs);
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    const measure = () => setSize(old => {
      const width = el.offsetWidth, height = el.offsetHeight;
      return old.width === width && old.height === height ? old : { width, height };
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const angle = layout.rotation * Math.PI / 180;
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const scale = size.width ? Math.min(1, size.width / Math.max(1, size.width * c + size.height * s)) : 1;
  const height = (size.width * s + size.height * c) * scale;
  return <div className="gazette-table-placement" style={{ width: `${layout.width}%`, marginLeft: `${(100 - layout.width) * layout.offset / 100}%` }}>
    <div className="gazette-table-frame" style={size.width ? { height } : undefined}>
      <div ref={content} className={size.width ? "gazette-table-rotated" : "gazette-table-measure"} style={size.width ? { transform: `translate(-50%, -50%) rotate(${layout.rotation}deg) scale(${scale})` } : undefined}>{children}</div>
    </div>
  </div>;
}