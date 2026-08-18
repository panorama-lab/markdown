import { Fragment, isValidElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";
import { render } from "../src/renderer/react.ts";

describe("render", () => {
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
    const ast = parse("{++new++}{--old--}");
    const tree = render(ast, { reviewMode: "clean" });
    expect(isValidElement(tree)).toBe(true);
  });

  it("renders review annotations alongside source markup", () => {
    const tree = render(parse("Original {++addition++} {>>clarify this<<}"), {
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
    expect(addition.props["data-review-id"]).toBe("0");
    expect(annotation.props.children).toBe("Suggested addition");
    expect(comment.props["data-comment"]).toBe(true);
    expect(comment.props["data-review-id"]).toBe("1");
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
