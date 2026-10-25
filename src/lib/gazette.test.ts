/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { cleanGazette, gazettePaths, gazetteTitle, imageLayout } from "./gazette";
describe("gazette document safety", () => {
  test("preserves the creator title across sanitizing and reading", () => {
    const doc = cleanGazette({ type: "doc", attrs: { title: "  Recherche du jour  " }, content: [] });
    expect(gazetteTitle(doc)).toBe("Recherche du jour");
  });
  test("preserves resized, moved and rotated image geometry", () => {
    const path = "dcc07b7a-9776-4030-983b-411864e46bf6/11111111-1111-1111-1111-111111111111.jpg";
    const doc = cleanGazette({ type: "doc", content: [{ type: "image", attrs: { storagePath: path, width: 45, offset: 60, rotation: -30 } }] });
    expect(imageLayout(doc?.content?.[0].attrs)).toEqual({ width: 45, offset: 60, rotation: -30 });
  });
  test("rejects unsafe geometry and retains legacy image defaults", () => {
    expect(imageLayout({ width: Infinity, rotation: "url(evil)", offset: NaN })).toEqual({ width: 100, offset: 0, rotation: 0 });
    expect(imageLayout()).toEqual({ width: 100, offset: 0, rotation: 0 });
  });
  test("keeps italic, underline, selected font and semantic ink", () => {
    const doc = cleanGazette({ type: "doc", content: [{ type: "text", text: "Actualité", marks: [{ type: "italic" }, { type: "underline" }, { type: "textStyle", attrs: { fontFamily: "Georgia", color: "var(--gazette-red)" } }] }] });
    expect(doc?.content?.[0].marks).toEqual([{ type: "italic" }, { type: "underline" }, { type: "textStyle", attrs: { fontFamily: "Georgia", color: "var(--gazette-red)" } }]);
  });
  test("rejects executable nodes, external image sources and CSS payloads", () => {
    const doc = cleanGazette({ type: "doc", content: [{ type: "script", text: "alert(1)" }, { type: "image", attrs: { src: "javascript:alert(1)" } }, { type: "text", text: "safe", marks: [{ type: "textStyle", attrs: { color: "url(https://evil.invalid)", fontFamily: "bad" } }] }] });
    expect(doc?.content?.length).toBe(1);
    expect(doc?.content?.[0].marks?.[0].attrs).toEqual({});
  });
  test("persists storage paths instead of expiring signed URLs", () => {
    const path = "dcc07b7a-9776-4030-983b-411864e46bf6/11111111-1111-1111-1111-111111111111.jpg";
    const doc = cleanGazette({ type: "doc", content: [{ type: "image", attrs: { storagePath: path, src: "https://example.invalid/temporary" } }] });
    expect(gazettePaths(doc)).toEqual([path]);
    expect(doc?.content?.[0].attrs?.src).toBeUndefined();
  });
  test("preserves table structure", () => {
    const doc = cleanGazette({ type: "doc", content: [{ type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Résultats" }] }] }] }] }] });
    expect(doc?.content?.[0].content?.[0].content?.[0].type).toBe("tableHeader");
  });
});