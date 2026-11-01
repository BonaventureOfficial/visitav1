/// <reference types="bun" />
import { expect, test } from "bun:test";
import { gesturePair, gestureLayout } from "./gazette-gestures";

test("two fingers resize and translate the object together", () => {
  const initial = { width: 50, offset: 50, rotation: 0 };
  const pair = gesturePair([{ x: 20, y: 40 }, { x: 80, y: 40 }]);
  expect(pair).toEqual({ x: 50, y: 40, distance: 60, angle: 0 });
  expect(gestureLayout(initial, 400, 20, 1.5, 30)).toEqual({ width: 75, offset: 70, rotation: 30 });
});
test("pinching inward and translating left remain independent", () => {
  expect(gestureLayout({ width: 80, offset: 50, rotation: 0 }, 400, -60, 0.5)).toEqual({ width: 40, offset: 25, rotation: 0 });
});
test("rotation wraps and finite geometry stays within the paper", () => {
  expect(gestureLayout({ width: 50, offset: 50, rotation: 170 }, 400, 200, 10, 30)).toEqual({ width: 100, offset: 0, rotation: -160 });
});