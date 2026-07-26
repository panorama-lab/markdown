import type { RenderOptions } from "./ast.ts";

export const INCH = 72;

export const APAStyle: RenderOptions = {
  pageSize: "LETTER",
  margin: 1,
  fontFamily: "Times-Roman",
  fontSize: 12,
  lineHeight: 2,
  paragraphIndent: 0.5,
  textAlign: "left",
  titleAlign: "center",
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
