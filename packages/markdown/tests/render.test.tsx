import { isValidElement } from "react";
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
});
