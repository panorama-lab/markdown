import { isValidElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";
import { render } from "../src/renderer/pdf.ts";
import { APAStyle, resolveFontFamily, resolveMargin, INCH } from "../src/styles.ts";

describe("APAStyle", () => {
  it("has APA paper layout defaults", () => {
    expect(APAStyle.pageSize).toBe("LETTER");
    expect(APAStyle.margin).toBe(1);
    expect(APAStyle.fontFamily).toBe("Times-Roman");
    expect(APAStyle.fontSize).toBe(12);
    expect(APAStyle.lineHeight).toBe(2);
    expect(APAStyle.paragraphIndent).toBe(0.5);
    expect(APAStyle.titleAlign).toBe("center");
    expect(APAStyle.headings?.[1]?.textAlign).toBe("center");
    expect(APAStyle.headings?.[1]?.fontWeight).toBe("bold");
    expect(APAStyle.headings?.[2]?.textAlign).toBe("left");
    expect(APAStyle.headings?.[3]?.fontStyle).toBe("italic");
  });
});

describe("resolveMargin", () => {
  it("expands a single inch value to all sides in points", () => {
    expect(resolveMargin(1)).toEqual({
      top: INCH,
      right: INCH,
      bottom: INCH,
      left: INCH,
    });
  });

  it("supports per-side margins in inches", () => {
    expect(resolveMargin({ top: 1, right: 1.25, bottom: 1, left: 1.5 })).toEqual({
      top: INCH,
      right: 1.25 * INCH,
      bottom: INCH,
      left: 1.5 * INCH,
    });
  });
});

describe("resolveFontFamily", () => {
  it("maps times variants", () => {
    expect(resolveFontFamily("Times-Roman")).toBe("Times-Roman");
    expect(resolveFontFamily("Times-Roman", "bold")).toBe("Times-Bold");
    expect(resolveFontFamily("Times-Roman", "normal", "italic")).toBe("Times-Italic");
    expect(resolveFontFamily("Times-Roman", "bold", "italic")).toBe("Times-BoldItalic");
  });
});

describe("pdf render", () => {
  it("returns a react element for simple markdown", () => {
    const tree = render(parse("# hello"), APAStyle);
    expect(isValidElement(tree)).toBe(true);
  });

  it("renders with custom margins and heading format", () => {
    const tree = render(parse("# Introduction\n\nBody paragraph."), {
      pageSize: "A4",
      margin: { top: 1, right: 1, bottom: 1, left: 1.25 },
      fontFamily: "Helvetica",
      fontSize: 11,
      lineHeight: 1.5,
      paragraphIndent: 0.5,
      headings: {
        1: { fontWeight: "bold", textAlign: "left", fontSize: 14 },
      },
    });
    expect(isValidElement(tree)).toBe(true);
  });

  it("renders paper front matter", () => {
    const tree = render(
      parse(`---
title: Paper Title
authors:
  - name: A. Author
abstract: Summary text.
keywords:
  - demo
---

# Introduction

Hello.
`),
      APAStyle,
    );
    expect(isValidElement(tree)).toBe(true);
  });
});
