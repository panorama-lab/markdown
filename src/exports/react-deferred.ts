import { createElement, useEffect, useRef, useState } from "react";

import type { Document } from "../ast.ts";

import { render as renderDocument, type ReactRenderOptions } from "../renderer/react-document.ts";
import { formulaProps } from "../renderer/react-math.ts";

export type { CitationStyleName, RenderOptions } from "../ast.ts";
export type { ReactRenderOptions, TableOfContentsLink } from "../renderer/react-document.ts";

let observer: IntersectionObserver | undefined;
const pendingFormulas = new WeakMap<Element, () => void>();

function observeFormula(element: Element, typeset: () => void) {
  if (typeof IntersectionObserver === "undefined") {
    typeset();
    return;
  }

  observer ??= new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const typeset = pendingFormulas.get(entry.target);
        pendingFormulas.delete(entry.target);
        typeset?.();
      }
    },
    { rootMargin: "300px 0px" },
  );
  const activeObserver = observer;
  pendingFormulas.set(element, typeset);
  activeObserver.observe(element);
  return () => {
    activeObserver.unobserve(element);
    pendingFormulas.delete(element);
  };
}

function DeferredFormula({ value, display }: { value: string; display: boolean }) {
  const ref = useRef<HTMLDivElement | HTMLSpanElement>(null);
  const [markup, setMarkup] = useState<string>();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let cancelled = false;
    const stopObserving = observeFormula(element, () => {
      void import("../renderer/math.ts").then(
        ({ typesetMath }) => {
          if (!cancelled) setMarkup(typesetMath(value, display)?.markup);
        },
        () => {
          // The TeX stays readable if the MathJax chunk fails to load.
        },
      );
    });
    return () => {
      cancelled = true;
      stopObserving?.();
    };
  }, [value, display]);

  return createElement(
    display ? "div" : "span",
    { ref, ...formulaProps(value, display, markup) },
    markup ? undefined : value,
  );
}

export function render(ast: Document, options?: ReactRenderOptions) {
  return renderDocument(ast, options, (value, display, key) =>
    createElement(DeferredFormula, { key: `${key}:${display}:${value}`, value, display }),
  );
}
