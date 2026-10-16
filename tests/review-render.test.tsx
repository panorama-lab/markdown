import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";
import { render } from "../src/renderer/react.ts";
import { listReviewMarkers } from "../src/review.ts";

describe("review source identities", () => {
  it.each([
    "[^a]: :insert[note]\n\nBody[^a] :delete[body]",
    ":comment[outer :comment[note]] :insert[real]",
    "\\:insert[literal] :delete[real]",
    '---\ntitle: ":insert[title]"\n---\n\n:delete[body]',
    "  ```\n  :insert[literal]\n  ```\n\n:delete[real]",
  ])("matches every review card to its rendered marker in %s", (source) => {
    const document = parse(source);
    const html = renderToStaticMarkup(render(document));
    expect(html).not.toContain("data-review-annotation");
    expect(html).not.toMatch(/Suggested (addition|deletion|replacement)/);
    const markers = listReviewMarkers(document);
    expect([...html.matchAll(/data-review-id="([^"]+)"/g)].map((match) => match[1]).sort()).toEqual(
      markers.map((marker) => marker.id).sort(),
    );
    for (const marker of markers) {
      expect(html).toContain(`data-review="${marker.kind}" data-review-id="${marker.id}"`);
    }
  });

  it("namespaces external markers without shifting content markers", () => {
    const source = "::table[Cap](src=table.md)\n\n:delete[body]";
    const document = parse(source, { files: { "table.md": ":insert[external]" } });
    const markers = listReviewMarkers(document);
    const html = renderToStaticMarkup(render(document));
    expect(html).not.toContain("data-review-annotation");
    expect(html).not.toMatch(/Suggested (addition|deletion|replacement)/);
    const external = markers.find((marker) => marker.file === "table.md")!;
    const body = markers.find((marker) => marker.file === undefined)!;
    expect(external.id).toBe("file:table.md:0");
    expect(body.id).toBe(String(source.indexOf(":delete[body]")));
    expect(html).toContain(`data-review-id="${external.id}">external</ins>`);
    expect(html).toContain(`data-review-id="${body.id}">body</del>`);
  });
});

describe("directive rendering", () => {
  it.each(["markup", "clean", "accepted"] as const)(
    "keeps original comment text in %s mode",
    (reviewMode) => {
      const html = renderToStaticMarkup(
        render(parse(":comment[Original **text**]{#c1}"), { reviewMode }),
      );
      expect(html).toContain("Original <strong>text</strong>");
      expect(html.includes('data-review-id="c1"')).toBe(reviewMode === "markup");
    },
  );

  it.each([":delete[old]:insert[new]{#c4}", ":insert[new]{#c4}:delete[old]"])(
    "renders one replacement thread for %s",
    (source) => {
      const doc = parse(source);
      const html = renderToStaticMarkup(render(doc));
      expect([...html.matchAll(/data-review-id="c4"/g)]).toHaveLength(1);
      expect(html).toContain("<del>old</del>");
      expect(html).toContain("<ins>new</ins>");
      const clean = renderToStaticMarkup(render(doc, { reviewMode: "clean" }));
      const accepted = renderToStaticMarkup(render(doc, { reviewMode: "accepted" }));
      expect(clean).toContain("old");
      expect(clean).not.toContain("new");
      expect(accepted).toContain("new");
      expect(accepted).not.toContain("old");
    },
  );
});
