import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";

describe("parse document shape", () => {
  it("returns full document fields", () => {
    const doc = parse("# Hello");
    expect(doc).toMatchObject({
      meta: null,
      body: expect.any(Array),
      bibliography: [],
      warnings: [],
    });
  });
});

describe("front matter", () => {
  it("parses title authors abstract keywords", () => {
    const doc = parse(`---
title: Paper title
doi: "10.1145/3706468.3706491"
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
      doi: "10.1145/3706468.3706491",
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
  it("preserves nested lists and resumes parent siblings", () => {
    const doc = parse("- parent\n  - nested\n    3. deep\n    4. next\n  - sibling\n- final\n");
    const list = doc.body[0];
    expect(list).toMatchObject({ type: "list", ordered: false });
    if (list.type !== "list") return;
    expect(list.children).toHaveLength(2);
    const nested = list.children[0].children[1];
    expect(nested).toMatchObject({ type: "list", ordered: false });
    if (nested.type !== "list") return;
    expect(nested.children).toHaveLength(2);
    expect(nested.children[0].children[1]).toMatchObject({
      type: "list",
      ordered: true,
      start: 3,
      children: [{ type: "listItem" }, { type: "listItem" }],
    });
  });

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

  it("parses numeric inline citations", () => {
    const doc = parse("Prior work [1] and follow-up work [2, 3].");
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    expect(p.children.filter((c) => c.type === "cite")).toEqual([
      { type: "cite", keys: ["1"] },
      { type: "cite", keys: ["2", "3"] },
    ]);
  });

  it("includes citations from referenced table files in reading order", () => {
    const doc = parse(
      "::table[Results]{src=results.md}\n\nLater :cite[wang2023].\n\n::references\n",
      {
        files: {
          "results.md": "| Source |\n| --- |\n| :cite[wang2024, missing] |\n",
          "references.bib": bib,
        },
      },
    );
    expect(doc.bibliography.map((entry) => entry.key)).toEqual(["wang2024", "wang2023"]);
    expect(doc.warnings).toEqual([
      { code: "unknown-cite-key", message: "Unknown citation key: missing" },
    ]);
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

describe("table of contents", () => {
  it("parses directive with title and levels", () => {
    const doc = parse("::table_of_contents[Table of contents]{levels=3}\n");
    expect(doc.body[0]).toEqual({
      type: "tableOfContents",
      title: "Table of contents",
      levels: 3,
      id: undefined,
    });
  });

  it("defaults levels to 3 and allows an id", () => {
    const doc = parse("::table_of_contents[Contents]{#toc}\n");
    expect(doc.body[0]).toMatchObject({
      type: "tableOfContents",
      title: "Contents",
      levels: 3,
      id: "toc",
    });
  });

  it("clamps levels to the 1-6 range", () => {
    const doc = parse("::table_of_contents[Contents]{levels=9}\n");
    expect(doc.body[0]).toMatchObject({ type: "tableOfContents", levels: 6 });
  });

  it("does not leak into paragraphs", () => {
    const doc = parse("::table_of_contents\n\nAfter\n");
    expect(doc.body[0]).toMatchObject({ type: "tableOfContents" });
    expect(doc.body[1]).toMatchObject({ type: "paragraph" });
  });
});

describe("figures and tables", () => {
  it("parses figure with caption src and id", () => {
    const doc = parse("::figure[System overview]{#fig-system src=figures/system.png}\n", {
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
    const doc = parse("::image[]{src=image_p12_0.png}\n", {
      files: { "image_p12_0.png": "data:image/png;base64,abc" },
    });
    expect(doc.body[0]).toMatchObject({
      type: "figure",
      src: "image_p12_0.png",
    });
    expect(doc.warnings).toHaveLength(0);
  });

  it("does not hang on unknown directives", () => {
    const doc = parse("::unknown[x]{src=a}\n\nAfter\n");
    expect(doc.body.length).toBeGreaterThanOrEqual(2);
    expect(doc.body[0]).toMatchObject({ type: "paragraph" });
  });

  it("warns on missing figure asset", () => {
    const doc = parse("::figure[Cap]{src=figures/missing.png}\n");
    expect(doc.warnings.some((w) => w.code === "missing-asset")).toBe(true);
  });

  it("parses table directive and resolves body from files", () => {
    const doc = parse("::table[Results]{#tab-results src=tables/results.md}\n", {
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

describe("review directives", () => {
  it("parses addition deletion substitution comment", () => {
    const doc = parse(":insert[inserted] :delete[removed] :delete[old]:insert[new] :comment[note]");
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    const types = p.children.map((c) => c.type);
    expect(types).toContain("addition");
    expect(types).toContain("deletion");
    expect(types).toContain("substitution");
    expect(types).toContain("comment");
    const comment = p.children.find((c) => c.type === "comment");
    expect(comment).toMatchObject({ type: "comment", children: [{ type: "text", value: "note" }] });
  });

  it("leaves directives inside code as literal text", () => {
    const doc = parse("Use `:insert[not a marker]` in code.\n\n```\n:delete[also literal]\n```\n");
    const p = doc.body[0];
    expect(p.type).toBe("paragraph");
    if (p.type !== "paragraph") return;
    expect(p.children.some((c) => c.type === "addition")).toBe(false);
    const code = p.children.find((c) => c.type === "inlineCode");
    expect(code).toMatchObject({ type: "inlineCode", value: ":insert[not a marker]" });
    expect(doc.body[1]).toMatchObject({ type: "code", value: ":delete[also literal]" });
  });
});

describe("blockquote", () => {
  it("parses block quotes", () => {
    const doc = parse("> quoted line\n");
    expect(doc.body[0]).toMatchObject({ type: "blockquote" });
  });
});

it("keeps escaped emphasis delimiters inside formatted text", () => {
  const doc = parse(String.raw`*\*Observed (O), Reported (R)* and **a \*\* marker**`);
  expect(doc.body[0]).toEqual({
    type: "paragraph",
    children: [
      { type: "emphasis", children: [{ type: "text", value: "*Observed (O), Reported (R)" }] },
      { type: "text", value: " and " },
      { type: "strong", children: [{ type: "text", value: "a ** marker" }] },
    ],
  });
});

it("preserves TeX in formulas, table cells, and captions", () => {
  const ast =
    parse(String.raw`Measured in :math[\mathrm{cm}^{2}] using :math[x^{n+1}] and :math[\frac{a}{b}].

:::math{#eq-6 number=6}
 a_{i} &= b_{i} \\
 c &= d
:::

| Formula | Value |
| --- | --- |
| :math[|x|] | :math[a\mid b] |

::figure[Value :math[x_{[i]}]]{src=p.png}
`);
  expect(ast.body).toMatchObject([
    {
      type: "paragraph",
      children: [
        { type: "text", value: "Measured in " },
        { type: "inlineMath", value: String.raw`\mathrm{cm}^{2}` },
        { type: "text", value: " using " },
        { type: "inlineMath", value: "x^{n+1}" },
        { type: "text", value: " and " },
        { type: "inlineMath", value: String.raw`\frac{a}{b}` },
        { type: "text", value: "." },
      ],
    },
    { type: "displayMath", id: "eq-6", number: "6", value: " a_{i} &= b_{i} \\\\\n c &= d" },
    {
      type: "table",
      rows: [
        {
          children: [
            { children: [{ type: "inlineMath", value: "|x|" }] },
            { children: [{ type: "inlineMath", value: String.raw`a\mid b` }] },
          ],
        },
      ],
    },
    {
      type: "figure",
      caption: [
        { type: "text", value: "Value " },
        { type: "inlineMath", value: "x_{[i]}" },
      ],
    },
  ]);
});

it("keeps currency, escaped dollars, code, and unclosed delimiters readable", () => {
  const ast = parse("Pay $5 or $10. \\$x, `$x$` and x²[^a]. It's $x\n\ny$ or $z.\n\n$$\nunclosed");
  expect(ast.body).toMatchObject([
    {
      type: "paragraph",
      children: [
        { type: "text", value: "Pay $5 or $10. $x, " },
        { type: "inlineCode", value: "$x$" },
        { type: "text", value: " and x²" },
        { type: "footnoteRef", id: "a" },
        { type: "text", value: ". It's $x" },
      ],
    },
    { type: "paragraph", children: [{ type: "text", value: "y$ or $z." }] },
    { type: "paragraph", children: [{ type: "text", value: "$$ unclosed" }] },
  ]);
});

it("resolves equation references and preserves printed labels independently of IDs", () => {
  const ast = parse(
    "See :ref[Equation A.1]{#eq-a-1} or :ref{#eq-a-1}. :ref[Missing]{#eq-2}\n\n" +
      '::::math{id=eq-a-1 number="A.1"}\nx = y\n:::\nz = w\n::::',
  );
  expect(ast.body).toEqual([
    {
      type: "paragraph",
      children: [
        { type: "text", value: "See " },
        { type: "ref", id: "eq-a-1", label: "Equation A.1" },
        { type: "text", value: " or " },
        { type: "ref", id: "eq-a-1", label: "eq-a-1" },
        { type: "text", value: ". " },
        { type: "ref", id: "eq-2", label: "Missing" },
      ],
    },
    { type: "displayMath", id: "eq-a-1", number: "A.1", value: "x = y\n:::\nz = w" },
  ]);
  expect(ast.warnings).toEqual([{ code: "unresolved-ref", message: "Unresolved reference: eq-2" }]);
});

it("keeps quoted inline TeX and legacy dollars literal where appropriate", () => {
  const ast = parse("**:math[`\\left[0,1\\right)`]** $x$ :math[unclosed\n\n$$\ny\n$$");
  expect(ast.body).toEqual([
    {
      type: "paragraph",
      children: [
        { type: "strong", children: [{ type: "inlineMath", value: "\\left[0,1\\right)" }] },
        { type: "text", value: " $x$ :math[unclosed" },
      ],
    },
    { type: "paragraph", children: [{ type: "text", value: "$$ y $$" }] },
  ]);
});

it("reads brace attributes with quoted values and optional leaf labels", () => {
  const ast = parse(
    '::figure{id=fig-a src="figures/a (1).png"}\n\n::table_of_contents{#toc levels=2}',
    {
      files: { "figures/a (1).png": "data:image/png;base64,abc" },
    },
  );
  expect(ast.body).toEqual([
    { type: "figure", id: "fig-a", src: "figures/a (1).png", caption: [] },
    { type: "tableOfContents", id: "toc", levels: 2, title: "" },
  ]);
});
