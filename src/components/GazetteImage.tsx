import { useState } from "react";
import { imageLayout } from "@/lib/gazette";

/** Rotation reserves its real bounding box, so adjacent text never gets covered. */
export function GazetteImage({ src, alt, attrs }: { src: string; alt: string; attrs?: Record<string, unknown> }) {
  const [ratio, setRatio] = useState(1);
  const { rotation } = imageLayout(attrs);
  const angle = rotation * Math.PI / 180;
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const factor = c + s / ratio;
  return <div className="gazette-image-frame" style={{ aspectRatio: (ratio * c + s) / (ratio * s + c) }}>
    <img src={src} alt={alt} draggable={false} decoding="async" onLoad={e => { const image = e.currentTarget; if (image.naturalHeight) setRatio(image.naturalWidth / image.naturalHeight); }} style={{ width: `${100 / factor}%`, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
  </div>;
}