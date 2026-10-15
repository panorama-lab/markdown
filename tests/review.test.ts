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

describe("source-aware review markers", () => {
  it.each([
    "\\{++literal++} {--real--}",
    '---\ntitle: "{++title++}"\n---\n\n{--real--}',
    '---\r\ntitle: "{++title++}"\r\n---\r\n\r\n{--real--}',
    "  ```\n  {++literal++}\n  ```\n\n{--real--}",
    "> ```\n> {++literal++}\n> ```\n\n{--real--}",
    "[link](https://example.com/{++literal++}) {--real--}",
  ])("only lists parsed markers in %s", (source) => {
    expect(listCriticMarkers(source)).toEqual([
      expect.objectContaining({
        kind: "deletion",
        text: "real",
        id: String(source.indexOf("{--real--}")),
        start: source.indexOf("{--real--}"),
        end: source.indexOf("{--real--}") + 10,
      }),
    ]);
  });

  it.each([
    "# {++same++} {++same++} {#heading}",
    "> {++same++}\n> {++same++}",
    "- {++same++}\n- {++same++}",
    "[^a]: {++same++}\n    {++same++}",
    "| {++same++} | {++same++} |\n| --- | --- |",
    "::figure[{++same++} {++same++}](src=image.png)",
    "**{++same++}** [label {++same++}](url)",
    "😀 {++same++}  \r\n{++same++}",
  ])("preserves offsets through block and inline transformations in %s", (source) => {
    const markers = listCriticMarkers(source);
    const starts = [...source.matchAll(/\{\+\+same\+\+\}/g)].map((match) => match.index);
    expect(markers.map((marker) => marker.start)).toEqual(starts);
    for (const marker of markers) {
      expect(source.slice(marker.start, marker.end)).toBe("{++same++}");
      expect(source.slice(marker.contentStart, marker.contentEnd)).toBe(marker.text);
    }
  });

  it("lists nested markers with distinct source identities", () => {
    const source = "{==outer {>>note<<}==} {++real++}";
    expect(listCriticMarkers(source).map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: "0", kind: "highlight" },
      { id: "9", kind: "comment" },
      { id: "23", kind: "addition" },
    ]);
  });

  it("preserves raw multiline substitution text", () => {
    const source = "> {~~old\r\n> value~>new\r\n> value~~}";
    const [marker] = listCriticMarkers(source);
    expect(marker.oldText).toBe("old\r\n> value");
    expect(marker.newText).toBe("new\r\n> value");
    expect(source.slice(marker.start, marker.end)).toBe(source.slice(2));
  });
});
