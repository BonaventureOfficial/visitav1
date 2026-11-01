import { imageLayout } from "./gazette";

export type GesturePoint = { x: number; y: number };
export function gesturePair(points: GesturePoint[]) {
  const [a, b] = points;
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
}

/** Keep the midpoint under the fingers while resizing and translating. */
export function gestureLayout(initial: ReturnType<typeof imageLayout>, paperWidth: number, dx: number, scale = 1, angle = 0) {
  const width = imageLayout({ width: initial.width * scale }).width;
  const available = paperWidth * (100 - width) / 100;
  const left = paperWidth * (100 - initial.width) / 100 * initial.offset / 100 + dx + paperWidth * (initial.width - width) / 200;
  return imageLayout({ width, offset: available > 0 ? left / available * 100 : 0, rotation: ((initial.rotation + angle + 540) % 360 + 360) % 360 - 180 });
}