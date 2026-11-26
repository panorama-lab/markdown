import { createElement } from "react";

import type { Document } from "../ast.ts";

import { typesetMath } from "../renderer/math.ts";
import { render as renderDocument, type ReactRenderOptions } from "../renderer/react-document.ts";
import { formulaProps } from "../renderer/react-math.ts";

export type { CitationStyleName, RenderOptions } from "../ast.ts";
export type { ReactRenderOptions, TableOfContentsLink } from "../renderer/react-document.ts";

export function render(ast: Document, options?: ReactRenderOptions) {
  return renderDocument(ast, options, (value, display, key) => {
    const formula = typesetMath(value, display);
    const tag = display ? "div" : "span";
    if (!formula) return createElement(tag, { key }, value);
    return createElement(tag, { key, ...formulaProps(value, display, formula.markup) });
  });
}
