import { describe, expect, it } from "vite-plus/test";

import { listCriticMarkers } from "../src/review.ts";

describe("listCriticMarkers", () => {
  it("lists additions, deletions, substitutions, highlights, and comments", () => {
    const source = "Add {++one++} and remove {--two--}. Replace {~~a~>b~~}. {==hl==}{>>note<<}";
    const markers = listCriticMarkers(source);
    expect(markers.map((m) => m.kind)).toEqual([
      "addition",
      "deletion",
      "substitution",
      "highlight",
      "comment",
    ]);
  });

  it("reports marker content and offsets", () => {
    const source = "A {++new++} B";
    const markers = listCriticMarkers(source);
    expect(markers[0]).toMatchObject({
      kind: "addition",
      text: "new",
      start: 2,
      end: 11,
      contentStart: 5,
      contentEnd: 8,
    });
  });

  it("ignores markers inside code", () => {
    const source = "`{++x++}` and\n```\n{--y--}\n```\n{++real++}";
    const markers = listCriticMarkers(source);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ kind: "addition", text: "real" });
  });
});
