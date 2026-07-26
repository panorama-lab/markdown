import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";

describe("parse document shape", () => {
  it("returns full document fields", () => {
    const doc = parse("# Hello");
    expect(doc).toMatchObject({
      meta: null,
      body: expect.any(Array),
      bibliography: [],
      reviews: [],
      warnings: [],
    });
  });
});

describe("front matter", () => {
  it("parses title authors abstract keywords", () => {
    const doc = parse(`---
title: Paper title
authors:
  - name: Ada Lovelace
    email: ada@example.com
    affiliation: Analytical Engines
    country: UK
    corresponding: true
abstract: |
  Paper abstract.
keywords:
  - keyword1
  - keyword2
---

# Introduction
`);
    expect(doc.meta).toEqual({
      title: "Paper title",
      authors: [
        {
          name: "Ada Lovelace",
          email: "ada@example.com",
          affiliation: "Analytical Engines",
          country: "UK",
          corresponding: true,
        },
      ],
      abstract: "Paper abstract.\n",
      keywords: ["keyword1", "keyword2"],
    });
    expect(doc.body[0]).toMatchObject({ type: "heading", depth: 1 });
  });

  it("allows missing front matter", () => {
    const doc = parse("Hello **world**");
    expect(doc.meta).toBeNull();
    expect(doc.body[0]).toMatchObject({ type: "paragraph" });
  });
});

describe("headings", () => {
  it("parses depths 1-6 and optional id", () => {
    const doc = parse(`# One
## Two
### Three
#### Four
##### Five
###### Six {#six}
`);
    expect(doc.body.map((b) => (b.type === "heading" ? b.depth : null))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    const last = doc.body[5];
    expect(last).toMatchObject({ type: "heading", id: "six" });
  });
});

describe("paragraphs and emphasis", () => {
  it("parses strong and italic", () => {
    const doc = parse("**strong** and _italic_ and *also*");
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    expect(p.children.map((c) => c.type)).toEqual([
      "strong",
      "text",
      "emphasis",
      "text",
      "emphasis",
    ]);
  });

  it("parses links and inline code", () => {
    const doc = parse("See [GitHub](https://github.com) and `code`.");
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    const link = p.children.find((c) => c.type === "link");
    expect(link).toMatchObject({ type: "link", url: "https://github.com" });
    const code = p.children.find((c) => c.type === "inlineCode");
    expect(code).toMatchObject({ type: "inlineCode", value: "code" });
  });

  it("parses fenced code blocks", () => {
    const doc = parse("```ts\nconst x = 1;\n```");
    expect(doc.body[0]).toMatchObject({
      type: "code",
      lang: "ts",
      value: "const x = 1;",
    });
  });

  it("parses strikethrough", () => {
    const doc = parse("before ~~struck~~ after");
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    expect(p.children.some((c) => c.type === "strikethrough")).toBe(true);
  });

  it("parses backslash escapes", () => {
    const doc = parse("replication\\_alesina\\_2023 and \\*star\\*");
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    const text = p.children.map((c) => (c.type === "text" ? c.value : "")).join("");
    expect(text).toContain("replication_alesina_2023");
    expect(text).toContain("*star*");
    expect(p.children.some((c) => c.type === "emphasis")).toBe(false);
  });
});

describe("lists", () => {
  it("parses unordered lists", () => {
    const doc = parse(`- first item
- second item
`);
    const list = doc.body[0];
    expect(list).toMatchObject({ type: "list", ordered: false });
    if (list.type !== "list") return;
    expect(list.children).toHaveLength(2);
  });

  it("parses ordered lists", () => {
    const doc = parse(`1. first step
2. second step
`);
    const list = doc.body[0];
    expect(list).toMatchObject({ type: "list", ordered: true, start: 1 });
    if (list.type !== "list") return;
    expect(list.children).toHaveLength(2);
  });
});

describe("footnotes", () => {
  it("parses footnote refs and definitions", () => {
    const doc = parse(`This claim needs a note.[^1]

[^1]: Footnote content goes here.
`);
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    expect(p.children.some((c) => c.type === "footnoteRef" && c.id === "1")).toBe(true);
    const def = doc.body.find((b) => b.type === "footnoteDefinition");
    expect(def).toMatchObject({ type: "footnoteDefinition", id: "1" });
  });
});

describe("citations and references", () => {
  const bib = `@article{wang2023,
  author = {Wang},
  title = {Baseline},
  year = {2023}
}
@article{wang2024,
  author = {Wang},
  title = {Refine},
  year = {2024}
}
`;

  it("parses single and multi cite keys", () => {
    const doc = parse(
      "Prior work :cite[wang2023]. Later :cite[wang2023, wang2024].\n\n::references\n",
      { files: { "references.bib": bib } },
    );
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    const cites = p.children.filter((c) => c.type === "cite");
    expect(cites[0]).toMatchObject({ type: "cite", keys: ["wang2023"] });
    expect(cites[1]).toMatchObject({ type: "cite", keys: ["wang2023", "wang2024"] });
    expect(doc.body.some((b) => b.type === "references")).toBe(true);
    expect(doc.bibliography.map((e) => e.key)).toEqual(["wang2023", "wang2024"]);
  });

  it("warns on unknown cite keys when bib is present", () => {
    const doc = parse(":cite[missing]\n", { files: { "references.bib": bib } });
    expect(doc.warnings.some((w) => w.code === "unknown-cite-key")).toBe(true);
  });
});

describe("cross-references", () => {
  it("parses ref with id", () => {
    const doc = parse(`# Introduction {#introduction}

See :ref[Introduction]{#introduction} for setup.
`);
    const p = doc.body[1];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    expect(p.children.some((c) => c.type === "ref" && c.id === "introduction")).toBe(true);
    expect(doc.warnings.filter((w) => w.code === "unresolved-ref")).toHaveLength(0);
  });

  it("warns on unresolved refs", () => {
    const doc = parse("See :ref[Missing]{#nope}.");
    expect(doc.warnings.some((w) => w.code === "unresolved-ref")).toBe(true);
  });
});

describe("pagebreak", () => {
  it("parses leaf directive", () => {
    const doc = parse("::pagebreak\n");
    expect(doc.body[0]).toEqual({ type: "pagebreak" });
  });
});

describe("figures and tables", () => {
  it("parses figure with caption src and id", () => {
    const doc = parse("::figure[System overview](src=figures/system.png){#fig-system}\n", {
      files: { "figures/system.png": "data:image/png;base64,abc" },
    });
    expect(doc.body[0]).toMatchObject({
      type: "figure",
      src: "figures/system.png",
      id: "fig-system",
    });
    expect(doc.warnings).toHaveLength(0);
  });

  it("parses image directive as figure", () => {
    const doc = parse("::image[](src=image_p12_0.png)\n", {
      files: { "image_p12_0.png": "data:image/png;base64,abc" },
    });
    expect(doc.body[0]).toMatchObject({
      type: "figure",
      src: "image_p12_0.png",
    });
    expect(doc.warnings).toHaveLength(0);
  });

  it("does not hang on unknown directives", () => {
    const doc = parse("::unknown[x](src=a)\n\nAfter\n");
    expect(doc.body.length).toBeGreaterThanOrEqual(2);
    expect(doc.body[0]).toMatchObject({ type: "paragraph" });
  });

  it("warns on missing figure asset", () => {
    const doc = parse("::figure[Cap](src=figures/missing.png)\n");
    expect(doc.warnings.some((w) => w.code === "missing-asset")).toBe(true);
  });

  it("parses table directive and resolves body from files", () => {
    const doc = parse("::table[Results](src=tables/results.md){#tab-results}\n", {
      files: {
        "tables/results.md": `| a | b |
| --- | --- |
| 1 | 2 |
`,
      },
    });
    const t = doc.body[0];
    expect(t).toMatchObject({
      type: "tableDirective",
      src: "tables/results.md",
      id: "tab-results",
    });
    if (t.type !== "tableDirective") return;
    expect(t.body?.[0]).toMatchObject({ type: "table" });
  });

  it("parses pipe tables in body", () => {
    const doc = parse(`| Name | Score |
| --- | --- |
| A | 1 |
| B | 2 |
`);
    const t = doc.body[0];
    expect(t.type).toBe("table");
    if (t.type !== "table") return;
    expect(t.header.children).toHaveLength(2);
    expect(t.rows).toHaveLength(2);
  });
});

describe("CriticMarkup", () => {
  it("parses addition deletion substitution highlight comment", () => {
    const doc = parse(
      '{++inserted++} {--removed--} {~~old~>new~~} {==hl==}{>>note<<}{id="c1" by="user" at="2026-01-01T00:00:00.000Z"}',
    );
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    const types = p.children.map((c) => c.type);
    expect(types).toContain("addition");
    expect(types).toContain("deletion");
    expect(types).toContain("substitution");
    expect(types).toContain("highlight");
    expect(types).toContain("comment");
    const comment = p.children.find((c) => c.type === "comment");
    expect(comment).toMatchObject({
      type: "comment",
      text: "note",
      meta: { id: "c1", by: "user", at: "2026-01-01T00:00:00.000Z" },
    });
  });

  it("collects review threads with re", () => {
    const doc = parse(
      `{==text==}{>>q<<}{id="c3" by="user" at="2026-04-30T20:18:51.163Z"}{>>a<<}{id="c4" by="AI" at="2026-04-30T20:19:39.000Z" re="c3"}`,
    );
    expect(doc.reviews).toHaveLength(1);
    expect(doc.reviews[0].id).toBe("c3");
    expect(doc.reviews[0].comments.map((c) => c.id)).toEqual(["c3", "c4"]);
  });
});

describe("blockquote", () => {
  it("parses block quotes", () => {
    const doc = parse("> quoted line\n");
    expect(doc.body[0]).toMatchObject({ type: "blockquote" });
  });
});
