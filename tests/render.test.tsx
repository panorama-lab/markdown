import { Fragment, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";
import { render } from "../src/renderer/react.ts";

describe("render", () => {
  it("renders an optional toggleable contents sidebar linked to unique heading anchors", () => {
    const ast = parse("## Details\n\n# Overview\n\n## Details\n\n# Named {#custom}\n");
    const html = renderToStaticMarkup(render(ast, { tableOfContents: true }));
    expect(html).toContain('aria-label="Table of contents"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Hide contents");
    for (const id of ["details", "overview", "details-2", "custom"]) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
      expect(html.match(new RegExp(`id="${id}"`, "g"))).toHaveLength(1);
    }
  });

  it("omits the sidebar when disabled or when the document has no headings", () => {
    expect(renderToStaticMarkup(render(parse("# Heading")))).not.toContain("data-toc-layout");
    expect(renderToStaticMarkup(render(parse("Body"), { tableOfContents: true }))).not.toContain(
      "data-toc-layout",
    );
  });

  it("renders DOI-only metadata as a clickable resolver link", () => {
    const html = renderToStaticMarkup(render(parse('---\ndoi: "10.1145/3706468.3706491"\n---\n')));
    expect(html).toContain("<header>");
    expect(html).toContain('href="https://doi.org/10.1145/3706468.3706491"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">10.1145/3706468.3706491</a>");
  });

  it("encodes DOI URL characters and omits blank DOI metadata", () => {
    const html = renderToStaticMarkup(
      render(parse('---\ndoi: "10.1000/example#section?version=1"\n---\n')),
    );
    expect(html).toContain('href="https://doi.org/10.1000/example%23section%3Fversion%3D1"');
    const empty = renderToStaticMarkup(render(parse('---\ndoi: "   "\n---\n')));
    expect(empty).not.toContain("<header>");
    expect(empty).not.toContain("doi.org");
  });

  it("returns a react element for simple markdown", () => {
    const tree = render(parse("# testing"));
    expect(isValidElement(tree)).toBe(true);
  });

  it("renders article with heading", () => {
    const tree = render(parse("# Hello")) as {
      type: string;
      props: { children: unknown };
    };
    expect(tree.type).toBe("article");
  });

  it("renders paper title as h1 and body headings offset by one", () => {
    const tree = render(
      parse(`---
title: Paper Title
---

# Introduction

## Methods
`),
    ) as { type: string; props: { children: unknown[] } };
    const children = Array.isArray(tree.props.children)
      ? tree.props.children.flat()
      : [tree.props.children];
    const header = children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "header",
    ) as { props: { children: unknown[] } } | undefined;
    expect(header).toBeTruthy();
    const title = (
      Array.isArray(header!.props.children) ? header!.props.children : [header!.props.children]
    ).find((c) => isValidElement(c) && (c as { type: string }).type === "h1");
    expect(title).toBeTruthy();
    expect((title as { props: { children: unknown } }).props.children).toBe("Paper Title");

    const headings = children.filter(
      (c) => isValidElement(c) && typeof (c as { type: string }).type === "string",
    ) as { type: string; props: { children: unknown } }[];
    const h2 = headings.find((c) => c.type === "h2");
    const h3 = headings.find((c) => c.type === "h3");
    expect(h2).toBeTruthy();
    expect(h3).toBeTruthy();
    expect(h2!.props.children).toBe("Introduction");
    expect(h3!.props.children).toBe("Methods");
  });

  it("renders front matter header", () => {
    const tree = render(
      parse(`---
title: T
authors:
  - name: A
abstract: Abs
---

Body
`),
    ) as { type: string; props: { children: unknown[] } };
    expect(tree.type).toBe("article");
    const children = Array.isArray(tree.props.children)
      ? tree.props.children.flat()
      : [tree.props.children];
    const header = children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "header",
    );
    expect(header).toBeTruthy();
  });

  it("renders figure with asset url", () => {
    const ast = parse("::figure[Cap](src=figures/a.png)\n");
    const tree = render(ast, { assets: { "figures/a.png": "blob:fig" } });
    expect(isValidElement(tree)).toBe(true);
  });

  it("renders image directive and strikethrough", () => {
    const ast = parse("::image[](src=img.png)\n\n~~old~~\n");
    const tree = render(ast, { assets: { "img.png": "blob:img" } });
    expect(isValidElement(tree)).toBe(true);
  });

  it("respects reviewMode clean", () => {
    const ast = parse(":insert[new]:delete[old]");
    const tree = render(ast, { reviewMode: "clean" });
    expect(isValidElement(tree)).toBe(true);
  });

  it("renders review markup without inline suggestion labels", () => {
    const tree = render(parse("Original :insert[addition] :comment[clarify this]"), {
      reviewMode: "markup",
    }) as { props: { children: unknown[] } };
    const paragraph = tree.props.children.find(
      (child) => isValidElement(child) && (child as { type: string }).type === "p",
    ) as { props: { children: unknown[] } };
    const children = paragraph.props.children.flatMap((child) =>
      isValidElement(child) && child.type === Fragment
        ? ((child.props as { children: unknown[] }).children ?? [])
        : child,
    );
    const addition = children.find(
      (child) =>
        isValidElement(child) &&
        (child as { props: Record<string, unknown> }).props["data-review"] === "addition",
    ) as { props: Record<string, unknown> };
    const annotation = children.find(
      (child) =>
        isValidElement(child) &&
        (child as { props: Record<string, unknown> }).props["data-review-annotation"] ===
          "addition",
    ) as { props: { children: unknown } };
    const comment = children.find(
      (child) =>
        isValidElement(child) &&
        (child as { props: Record<string, unknown> }).props["data-review"] === "comment",
    ) as { props: Record<string, unknown> };

    expect(addition.props["data-review"]).toBe("addition");
    expect(addition.props["data-review-id"]).toBe("9");
    expect(annotation).toBeUndefined();
    expect(comment.props["data-comment"]).toBe(true);
    expect(comment.props["data-review-id"]).toBe("27");
  });

  it("renders APA in-text citations by default", () => {
    const ast = parse("Prior work :cite[smith2024].\n", {
      files: {
        "references.bib": `@article{smith2024,\n  author = {Smith, John},\n  title = {A Study},\n  journal = {Journal},\n  year = {2024}\n}\n`,
      },
    });
    const tree = render(ast) as { props: { children: unknown[] } };
    const children = Array.isArray(tree.props.children)
      ? tree.props.children.flat()
      : [tree.props.children];
    const paragraph = children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "p",
    ) as { props: { children: unknown[] } };
    const cite = paragraph.props.children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "cite",
    ) as { props: { children: unknown[] } };
    expect(cite).toBeTruthy();
    const link = cite.props.children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "a",
    ) as { props: { children: unknown; href: string } };
    expect(link.props.children).toBe("Smith, 2024");
    expect(link.props.href).toBe("#ref-smith2024");
  });

  it("renders citations linked to references extracted from PDFs", () => {
    const ast = parse(
      "See :cite[ref-3, ref-7], :cite[smith2024a], :cite[verbert2020] and :cite[archive].\n\n::references",
      {
        files: {
          "references.bib": `@misc{ref-3,
  note = {First numbered reference.}
}
@misc{ref-7,
  note = {Another numbered reference.}
}
@misc{smith2024a,
  note = {Smith, J., & Jones, M. (2024a). A Study.}
}
@misc{verbert2020,
  note = {Verbert, K. et al. 2020. Learning analytics dashboards.}
}
@misc{archive,
  note = {An undated archived report.}
}`,
        },
      },
    );
    const html = renderToStaticMarkup(render(ast));
    expect(html).toContain('<cite>[<a href="#ref-ref-3">3</a>, <a href="#ref-ref-7">7</a>]</cite>');
    expect(html).toContain('<cite>(<a href="#ref-smith2024a">Smith &amp; Jones, 2024a</a>)</cite>');
    expect(html).toContain('<cite>(<a href="#ref-verbert2020">Verbert et al., 2020</a>)</cite>');
    expect(html).toContain('<cite>(<a href="#ref-archive">archive</a>)</cite>');
    expect(html).toContain('id="ref-ref-3"');
    expect(html).toContain("First numbered reference.");
  });

  it("renders APA references by default", () => {
    const ast = parse("Text :cite[smith2024].\n\n::references\n", {
      files: {
        "references.bib": `@article{smith2024,\n  author = {Smith, John},\n  title = {A Study},\n  journal = {Journal},\n  year = {2024}\n}\n`,
      },
    });
    const tree = render(ast) as { props: { children: unknown[] } };
    const children = Array.isArray(tree.props.children)
      ? tree.props.children.flat()
      : [tree.props.children];
    const section = children.find(
      (c) =>
        isValidElement(c) &&
        (c as { props: Record<string, unknown> }).props["data-references"] === true,
    ) as { props: { children: unknown[] } };
    const list = section.props.children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "ol",
    ) as { props: { children: unknown[] } };
    const item = (
      Array.isArray(list.props.children) ? list.props.children[0] : list.props.children
    ) as { props: { id: string; children: unknown[] } };
    expect(item.props.id).toBe("ref-smith2024");
    const flatten = (nodes: unknown[]): string =>
      nodes
        .map((node) => {
          if (typeof node === "string") return node;
          if (isValidElement(node)) {
            const inner = (node.props as { children?: unknown }).children;
            return flatten(Array.isArray(inner) ? inner : inner ? [inner] : []);
          }
          return "";
        })
        .join("");
    expect(flatten(item.props.children)).toBe("Smith, J. (2024). A Study. Journal.");
  });

  it("renders table of contents with nested heading links", () => {
    const tree = render(
      parse(`# Introduction

## Methods

### Estimation

## Results

::table_of_contents[Table of contents]{levels=3}
`),
    ) as { props: { children: unknown[] } };
    const children = Array.isArray(tree.props.children)
      ? tree.props.children.flat()
      : [tree.props.children];
    const nav = children.find(
      (c) =>
        isValidElement(c) && (c as { props: Record<string, unknown> }).props["data-toc"] === true,
    ) as { props: { children: unknown[] } };
    expect(nav).toBeTruthy();
    const title = nav.props.children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "h2",
    ) as { props: { children: unknown } };
    expect(title.props.children).toBe("Table of contents");
    const collectLinks = (nodes: unknown[]): { props: { href: string } }[] =>
      nodes.flatMap((n) => {
        if (!isValidElement(n)) return [];
        if (n.type === "a") return [n as { props: { href: string } }];
        const children = (n.props as { children?: unknown }).children;
        const list = Array.isArray(children) ? children : children ? [children] : [];
        return collectLinks(list);
      });
    const links = collectLinks(
      Array.isArray(nav.props.children) ? nav.props.children : [nav.props.children],
    );
    expect(links.map((a) => a.props.href)).toEqual([
      "#introduction",
      "#methods",
      "#estimation",
      "#results",
    ]);
    const heading = children.find(
      (c) => isValidElement(c) && (c as { type: string }).type === "h2",
    ) as { props: { id: string } };
    expect(heading.props.id).toBe("introduction");
  });
});
