import type { RenderOptions } from "./ast.ts";

export const INCH = 72;

export type PdfStyleName = "apa" | "ieee" | "acm";

export const APAStyle: RenderOptions = {
  pageSize: "LETTER",
  margin: 1,
  fontFamily: "Times-Roman",
  fontSize: 12,
  lineHeight: 2,
  paragraphIndent: 0.5,
  textAlign: "left",
  titleAlign: "center",
  titleFontSize: 12,
  keywordsLabel: "Keywords",
  headings: {
    1: {
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
      fontSize: 12,
      marginTop: 0,
      marginBottom: 0,
    },
    2: {
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "left",
      fontSize: 12,
      marginTop: 0,
      marginBottom: 0,
    },
    3: {
      fontWeight: "bold",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 12,
      marginTop: 0,
      marginBottom: 0,
    },
    4: {
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "left",
      fontSize: 12,
      indent: 0.5,
      marginTop: 0,
      marginBottom: 0,
    },
    5: {
      fontWeight: "bold",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 12,
      indent: 0.5,
      marginTop: 0,
      marginBottom: 0,
    },
    6: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 12,
      indent: 0.5,
      marginTop: 0,
      marginBottom: 0,
    },
  },
};

export const IEEEStyle: RenderOptions = {
  pageSize: "LETTER",
  margin: { top: 0.75, right: 0.625, bottom: 1, left: 0.625 },
  fontFamily: "Times-Roman",
  fontSize: 10,
  lineHeight: 1.15,
  paragraphIndent: 0.15,
  textAlign: "justify",
  titleAlign: "center",
  titleFontSize: 24,
  keywordsLabel: "Index Terms",
  columns: 2,
  columnGap: 0.25,
  headings: {
    1: {
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
      textTransform: "uppercase",
      fontSize: 10,
      marginTop: 12,
      marginBottom: 4,
    },
    2: {
      fontWeight: "bold",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 10,
      marginTop: 10,
      marginBottom: 4,
    },
    3: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 10,
      marginTop: 8,
      marginBottom: 4,
    },
    4: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 10,
      marginTop: 6,
      marginBottom: 2,
    },
    5: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 10,
      marginTop: 6,
      marginBottom: 2,
    },
    6: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 10,
      marginTop: 6,
      marginBottom: 2,
    },
  },
};

export const ACMStyle: RenderOptions = {
  pageSize: "LETTER",
  margin: { top: 0.75, right: 0.75, bottom: 1, left: 0.75 },
  fontFamily: "Times-Roman",
  fontSize: 9,
  lineHeight: 1.2,
  paragraphIndent: 0.15,
  textAlign: "justify",
  titleAlign: "center",
  titleFontSize: 17,
  keywordsLabel: "Keywords",
  headings: {
    1: {
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "left",
      fontSize: 10,
      marginTop: 12,
      marginBottom: 6,
    },
    2: {
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "left",
      fontSize: 10,
      marginTop: 10,
      marginBottom: 4,
    },
    3: {
      fontWeight: "bold",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 9,
      marginTop: 8,
      marginBottom: 4,
    },
    4: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 9,
      marginTop: 6,
      marginBottom: 2,
    },
    5: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 9,
      marginTop: 6,
      marginBottom: 2,
    },
    6: {
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "left",
      fontSize: 9,
      marginTop: 6,
      marginBottom: 2,
    },
  },
};

export const pdfStyles: Record<PdfStyleName, RenderOptions> = {
  apa: APAStyle,
  ieee: IEEEStyle,
  acm: ACMStyle,
};

export function resolvePdfStyle(name?: PdfStyleName | string): RenderOptions {
  if (name && name in pdfStyles) {
    return pdfStyles[name as PdfStyleName];
  }
  return APAStyle;
}

export function resolveMargin(margin: RenderOptions["margin"] = 1): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof margin === "number") {
    const value = margin * INCH;
    return { top: value, right: value, bottom: value, left: value };
  }
  return {
    top: (margin.top ?? 1) * INCH,
    right: (margin.right ?? 1) * INCH,
    bottom: (margin.bottom ?? 1) * INCH,
    left: (margin.left ?? 1) * INCH,
  };
}

export function resolvePageSize(pageSize: NonNullable<RenderOptions["pageSize"]> = "LETTER"): {
  width: number;
  height: number;
} {
  if (Array.isArray(pageSize)) {
    return { width: pageSize[0], height: pageSize[1] };
  }
  switch (pageSize) {
    case "LETTER":
      return { width: 612, height: 792 };
    case "LEGAL":
      return { width: 612, height: 1008 };
    case "A4":
      return { width: 595.28, height: 841.89 };
    case "A3":
      return { width: 841.89, height: 1190.55 };
    case "A5":
      return { width: 419.53, height: 595.28 };
    case "TABLOID":
      return { width: 792, height: 1224 };
    case "EXECUTIVE":
      return { width: 522, height: 756 };
    default:
      return { width: 612, height: 792 };
  }
}

export function resolveFontFamily(
  base: string,
  weight: "normal" | "bold" = "normal",
  style: "normal" | "italic" = "normal",
): string {
  const family = base.toLowerCase();
  const isTimes = family.includes("times");
  const isCourier = family.includes("courier");

  if (isTimes) {
    if (weight === "bold" && style === "italic") return "Times-BoldItalic";
    if (weight === "bold") return "Times-Bold";
    if (style === "italic") return "Times-Italic";
    return "Times-Roman";
  }

  if (isCourier) {
    if (weight === "bold" && style === "italic") return "Courier-BoldOblique";
    if (weight === "bold") return "Courier-Bold";
    if (style === "italic") return "Courier-Oblique";
    return "Courier";
  }

  if (weight === "bold" && style === "italic") return "Helvetica-BoldOblique";
  if (weight === "bold") return "Helvetica-Bold";
  if (style === "italic") return "Helvetica-Oblique";
  return "Helvetica";
}
