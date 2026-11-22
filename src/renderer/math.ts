import type { LiteElement } from "@mathjax/src/js/adaptors/lite/Element.js";

import { MathJaxTexFont } from "@mathjax/mathjax-tex-font/js/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const math = mathjax.document("", {
  InputJax: new TeX({
    packages: ["base", "ams", "boldsymbol", "cancel"],
    maxBuffer: 4096,
    tags: "ams",
  }),
  // The renderers use one SVG per formula.
  OutputJax: new SVG({
    fontCache: "none",
    fontData: MathJaxTexFont,
    linebreaks: { inline: false },
  }),
});

function outlineIndicators(svg: LiteElement) {
  // The TeX font omits U+1D7D9. Outline it before SVG rasterization or PDF drawing.
  const digit =
    "M64 0 H435 V-46 H328 V-720 H277 L87 -625 V-577 L186 -617 V-46 H64 Z M236 -46 V-640 L278 -662 V-46 Z";
  for (const text of adaptor.tags(svg, "text")) {
    if (adaptor.textContent(text) !== "𝟙") continue;
    const size = Number(adaptor.getAttribute(text, "font-size")?.replace(/px$/, ""));
    if (!Number.isFinite(size) || size <= 0) continue;
    const transform = adaptor.getAttribute(text, "transform") || "";
    const em = size / 1000;
    adaptor.replace(
      adaptor.node(
        "path",
        {
          d: digit,
          transform: (transform + " scale(" + em + "," + em + ")").trim(),
        },
        [],
        "http://www.w3.org/2000/svg",
      ),
      text,
    );
  }
}

export function typesetMath(value: string, display: boolean) {
  try {
    const container = math.convert(value, { display });
    const child = adaptor.firstChild(container);
    if (!child || adaptor.kind(child) !== "svg") return;
    const svg = child as LiteElement;
    const viewBox = adaptor.getAttribute(svg, "viewBox") ?? "";
    const [x, top, width, height] = viewBox.split(/\s+/).map(Number);
    if (![x, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    outlineIndicators(svg);
    adaptor.setAttribute(svg, "aria-hidden", "true");
    const markup = adaptor.outerHTML(svg);
    if (markup.includes('data-mml-node="merror"')) return;
    return {
      markup,
      viewBox,
      width: width / 1000,
      height: height / 1000,
      svg,
    };
  } catch {
    return;
  } finally {
    math.inputJax[0].reset();
  }
}

export function svgChildren(node: NonNullable<ReturnType<typeof typesetMath>>["svg"]) {
  return adaptor.childNodes(node).flatMap((child) => {
    const kind = adaptor.kind(child);
    if (kind.startsWith("#")) return [];
    const element = child as LiteElement;
    return [
      {
        kind,
        node: element,
        attrs: Object.fromEntries(
          adaptor.allAttributes(element).map(({ name, value }) => [name, value]),
        ),
      },
    ];
  });
}
