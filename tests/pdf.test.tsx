import { isValidElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";
import { render } from "../src/renderer/pdf.ts";
import {
  ACMStyle,
  APAStyle,
  IEEEStyle,
  INCH,
  pdfStyles,
  resolveFontFamily,
  resolveMargin,
  resolvePdfStyle,
} from "../src/styles.ts";

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

describe("IEEEStyle", () => {
  it("has IEEE conference two-column layout defaults", () => {
    expect(IEEEStyle.pageSize).toBe("LETTER");
    expect(IEEEStyle.margin).toEqual({ top: 0.75, right: 0.625, bottom: 1, left: 0.625 });
    expect(IEEEStyle.fontFamily).toBe("Times-Roman");
    expect(IEEEStyle.fontSize).toBe(10);
    expect(IEEEStyle.lineHeight).toBe(1.15);
    expect(IEEEStyle.textAlign).toBe("justify");
    expect(IEEEStyle.titleFontSize).toBe(24);
    expect(IEEEStyle.keywordsLabel).toBe("Index Terms");
    expect(IEEEStyle.columns).toBe(2);
    expect(IEEEStyle.columnGap).toBe(0.25);
    expect(IEEEStyle.headings?.[1]?.textTransform).toBe("uppercase");
    expect(IEEEStyle.headings?.[1]?.textAlign).toBe("center");
    expect(IEEEStyle.headings?.[2]?.fontStyle).toBe("italic");
  });
});

describe("ACMStyle", () => {
  it("has ACM conference layout defaults", () => {
    expect(ACMStyle.pageSize).toBe("LETTER");
    expect(ACMStyle.margin).toEqual({ top: 0.75, right: 0.75, bottom: 1, left: 0.75 });
    expect(ACMStyle.fontFamily).toBe("Times-Roman");
    expect(ACMStyle.fontSize).toBe(9);
    expect(ACMStyle.lineHeight).toBe(1.2);
    expect(ACMStyle.textAlign).toBe("justify");
    expect(ACMStyle.titleFontSize).toBe(17);
    expect(ACMStyle.keywordsLabel).toBe("Keywords");
    expect(ACMStyle.headings?.[1]?.fontWeight).toBe("bold");
    expect(ACMStyle.headings?.[1]?.textAlign).toBe("left");
    expect(ACMStyle.headings?.[3]?.fontStyle).toBe("italic");
  });
});

describe("pdfStyles", () => {
  it("maps style names to presets", () => {
    expect(pdfStyles.apa).toBe(APAStyle);
    expect(pdfStyles.ieee).toBe(IEEEStyle);
    expect(pdfStyles.acm).toBe(ACMStyle);
  });

  it("resolves known and unknown style names", () => {
    expect(resolvePdfStyle("ieee")).toBe(IEEEStyle);
    expect(resolvePdfStyle("acm")).toBe(ACMStyle);
    expect(resolvePdfStyle("apa")).toBe(APAStyle);
    expect(resolvePdfStyle("unknown")).toBe(APAStyle);
    expect(resolvePdfStyle()).toBe(APAStyle);
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

  it("renders with IEEE and ACM styles", () => {
    const source = parse("# Introduction\n\nBody paragraph.");
    expect(isValidElement(render(source, IEEEStyle))).toBe(true);
    expect(isValidElement(render(source, ACMStyle))).toBe(true);
  });

  it("renders IEEE two-column multi-page paper", () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) =>
        `This is paragraph ${i + 1} with enough text to wrap inside a narrow IEEE column and force pagination across multiple pages of the document.`,
    ).join("\n\n");
    const tree = render(
      parse(`---
title: Two-Column IEEE Paper Title That May Wrap Across Lines
authors:
  - name: First Author
    affiliation: University A
  - name: Second Author
    affiliation: University B
abstract: |
  This abstract appears in the left column of an IEEE two-column layout.
keywords:
  - machine learning
  - pdf export
---

# Introduction

${paragraphs}

## Related Work

${paragraphs}
`),
      IEEEStyle,
    );
    expect(isValidElement(tree)).toBe(true);
    expect(tree.props.children.length).toBeGreaterThan(1);
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
      IEEEStyle,
    );
    expect(isValidElement(tree)).toBe(true);
  });

  it("renders table of contents", () => {
    const tree = render(
      parse(`# Introduction

## Methods

::table_of_contents[Table of contents]{levels=3}
`),
      APAStyle,
    );
    expect(isValidElement(tree)).toBe(true);
  });
});
