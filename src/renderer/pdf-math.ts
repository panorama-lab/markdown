import type { Canvas } from "@react-pdf/renderer";
import type { ComponentProps } from "react";

import type { BlockNode } from "../ast.ts";

import { walkBlocks } from "../parse.ts";
import { svgChildren, typesetMath } from "./math.ts";

export type FormulaSize = { width: number; height: number };
export type InlineFormula = FormulaSize & { src: string };
export type DisplayFormula = FormulaSize & { paint: ComponentProps<typeof Canvas>["paint"] };
type MathPainter = {
  save(): MathPainter;
  restore(): MathPainter;
  scale(x: number, y: number): MathPainter;
  translate(x: number, y: number): MathPainter;
  fill(color: string): MathPainter;
  clip(): MathPainter;
  path(d: string): MathPainter;
  rect(x: number, y: number, width: number, height: number): MathPainter;
  lineWidth(value: number): MathPainter;
  moveTo(x: number, y: number): MathPainter;
  lineTo(x: number, y: number): MathPainter;
  stroke(color: string): MathPainter;
};
type MathDrawing = (painter: MathPainter) => void;

export async function prepareInlineMath(body: BlockNode[], fontSize: number) {
  const inlineMath = new Map<string, InlineFormula>();
  const pending = new Map<string, Promise<void>>();
  walkBlocks(body, (node) => {
    if (node.type !== "inlineMath" || pending.has(node.value)) return;
    const formula = typesetMath(node.value, false);
    if (!formula) return;
    pending.set(
      node.value,
      (async () => {
        try {
          // Text attachments in React PDF accept raster images. Render at four
          // pixels per point to keep scripts legible when the PDF is zoomed.
          const { mathImage } = await import("#math-image");
          const width = Math.max(1, Math.min(4096, Math.ceil(formula.width * fontSize * 4)));
          const height = Math.max(1, Math.ceil((width * formula.height) / formula.width));
          if (height > 4096) return;
          const src = await mathImage(sizedSvg(formula.markup, width, height), width, height);
          inlineMath.set(node.value, { width: formula.width, height: formula.height, src });
        } catch {
          // Source text remains available when a formula cannot be rasterized.
        }
      })(),
    );
  });
  await Promise.all(pending.values());
  return inlineMath;
}

function sizedSvg(markup: string, width: number, height: number) {
  return markup.replace(/^<svg[^>]*>/, (tag) =>
    tag
      .replace(/ (?:width|height|style)="[^"]*"/g, "")
      .replace(/>$/, ` width="${width}" height="${height}">`),
  );
}

export function typesetDisplayMath(value: string) {
  const formula = typesetMath(value, true);
  if (!formula) return;
  const draw = pdfSvgDrawing(formula.svg);
  if (!draw) return;
  const [left, top, svgWidth] = formula.viewBox.split(/\s+/).map(Number);
  const display: DisplayFormula = {
    width: formula.width,
    height: formula.height,
    paint(painter: MathPainter, width) {
      const scale = width / svgWidth;
      painter.save().scale(scale, scale).translate(-left, -top);
      draw(painter);
      painter.restore();
      return null;
    },
  };
  return display;
}

function pdfSvgDrawing(
  svg: NonNullable<ReturnType<typeof typesetMath>>["svg"],
): MathDrawing | undefined {
  const drawings: MathDrawing[] = [];
  for (const { kind, node, attrs } of svgChildren(svg)) {
    const transform: MathDrawing[] = [];
    const operations = /\s*(translate|scale)\(([^()]*)\)/gy;
    const source = attrs.transform?.trim() ?? "";
    let offset = 0;
    while (offset < source.length) {
      const operation = operations.exec(source);
      if (!operation) return;
      const [, type, values] = operation;
      const [x, y] = values.trim().split(/[ ,]+/).map(Number);
      if (!Number.isFinite(x) || (y !== undefined && !Number.isFinite(y))) return;
      transform.push(
        type === "translate"
          ? (painter) => painter.translate(x, y ?? 0)
          : (painter) => painter.scale(x, y ?? x),
      );
      offset = operations.lastIndex;
    }
    const fill = attrs.fill && attrs.fill !== "currentColor" ? attrs.fill : "black";
    let draw: MathDrawing | undefined;
    switch (kind) {
      case "g":
        draw = pdfSvgDrawing(node);
        break;
      case "svg": {
        // MathJax clips the extenders for tall delimiters and radicals to this viewport.
        const [left, top, viewWidth, viewHeight] = (attrs.viewBox ?? "")
          .trim()
          .split(/\s+/)
          .map(Number);
        const x = Number(attrs.x ?? 0);
        const y = Number(attrs.y ?? 0);
        const width = Number(attrs.width);
        const height = Number(attrs.height);
        if (
          ![left, top, viewWidth, viewHeight, x, y, width, height].every(Number.isFinite) ||
          width <= 0 ||
          height <= 0 ||
          width !== viewWidth ||
          height !== viewHeight
        )
          return;
        const content = pdfSvgDrawing(node);
        if (!content) return;
        draw = (painter) => {
          painter
            .rect(x, y, width, height)
            .clip()
            .translate(x - left, y - top);
          content(painter);
        };
        break;
      }
      case "path": {
        const path = expandSmoothQuadratics(attrs.d);
        draw = (painter) => painter.path(path).fill(fill);
        break;
      }
      case "rect":
        draw = (painter) =>
          painter
            .rect(
              Number(attrs.x ?? 0),
              Number(attrs.y ?? 0),
              Number(attrs.width),
              Number(attrs.height),
            )
            .fill(fill);
        break;
      case "line": {
        const stroke = attrs.stroke && attrs.stroke !== "currentColor" ? attrs.stroke : "black";
        draw = (painter) =>
          painter
            .lineWidth(Number(attrs["stroke-width"] ?? 1))
            .moveTo(Number(attrs.x1 ?? 0), Number(attrs.y1 ?? 0))
            .lineTo(Number(attrs.x2 ?? 0), Number(attrs.y2 ?? 0))
            .stroke(stroke);
        break;
      }
    }
    if (!draw) return;
    const paint = draw;
    drawings.push((painter) => {
      painter.save();
      transform.forEach((apply) => apply(painter));
      paint(painter);
      painter.restore();
    });
  }
  return (painter) => drawings.forEach((draw) => draw(painter));
}

function expandSmoothQuadratics(path: string): string {
  // PDFKit reflects the control point twice between consecutive absolute T commands.
  // MathJax emits absolute glyph outlines with each smooth quadratic written explicitly.
  return path.replace(/([MQ])([-\d. ]+)((?:T[-\d. ]+)+)/g, (_, command, points, curves) => {
    let [controlX, controlY, x = controlX, y = controlY] = points.trim().split(/ +/).map(Number);
    let result = command + points;
    for (const [, end] of curves.matchAll(/T([-\d. ]+)/g)) {
      controlX = 2 * x - controlX;
      controlY = 2 * y - controlY;
      [x, y] = end.trim().split(/ +/).map(Number);
      result += `Q${controlX} ${controlY} ${x} ${y}`;
    }
    return result;
  });
}

export function formulaDimensions(formula: FormulaSize, fontSize: number, width: number) {
  const scale = Math.min(fontSize, width / formula.width);
  return { width: formula.width * scale, height: formula.height * scale };
}
