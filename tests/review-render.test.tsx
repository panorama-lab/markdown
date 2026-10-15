import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";
import { render } from "../src/renderer/react.ts";
import { listCriticMarkers } from "../src/review.ts";

describe("review source identities", () => {
  it.each([
    "[^a]: {++note++}\n\nBody[^a] {--body--}",
    "{==outer {>>note<<}==} {++real++}",
    "\\{++literal++} {--real--}",
    '---\ntitle: "{++title++}"\n---\n\n{--body--}',
    "  ```\n  {++literal++}\n  ```\n\n{--real--}",
  ])("matches every review card to its rendered marker in %s", (source) => {
    const document = parse(source);
    const html = renderToStaticMarkup(render(document));
    const markers = listCriticMarkers(document);
    expect([...html.matchAll(/data-review-id="([^"]+)"/g)].map((match) => match[1]).sort()).toEqual(
      markers.map((marker) => marker.id).sort(),
    );
    for (const marker of markers) {
      expect(html).toContain(`data-review="${marker.kind}" data-review-id="${marker.id}"`);
    }
  });

  it("namespaces external markers without shifting content markers", () => {
    const source = "::table[Cap](src=table.md)\n\n{--body--}";
    const document = parse(source, { files: { "table.md": "{++external++}" } });
    const markers = listCriticMarkers(document);
    const html = renderToStaticMarkup(render(document));
    const external = markers.find((marker) => marker.file === "table.md")!;
    const body = markers.find((marker) => marker.file === undefined)!;
    expect(external.id).toBe("file:table.md:0");
    expect(body.id).toBe(String(source.indexOf("{--body--}")));
    expect(html).toContain(`data-review-id="${external.id}">external</ins>`);
    expect(html).toContain(`data-review-id="${body.id}">body</del>`);
  });
});
