import type { ReactNode } from "react";

import { createElement, Fragment } from "react";

import type {
  BlockNode,
  Document,
  InlineNode,
  RenderOptions,
  ReviewMode,
  TableRowNode,
} from "../ast.ts";

export function render(ast: Document, options?: RenderOptions): ReactNode {
  const assets = options?.assets ?? {};
  const reviewMode: ReviewMode = options?.reviewMode ?? "markup";
  const footnoteDefs = collectFootnotes(ast.body);

  return createElement(
    "article",
    null,
    renderMeta(ast),
    ...ast.body.map((node, i) =>
      renderBlock(node, i, { assets, reviewMode, bibliography: ast.bibliography }),
    ),
    footnoteDefs.length > 0
      ? createElement(
          "section",
          { key: "footnotes", "data-footnotes": true },
          createElement("hr"),
          createElement(
            "ol",
            null,
            ...footnoteDefs.map((def) =>
              createElement(
                "li",
                { key: def.id, id: `fn-${def.id}` },
                ...def.children.map((c, i) =>
                  renderBlock(c, i, { assets, reviewMode, bibliography: ast.bibliography }),
                ),
                createElement("a", { href: `#fnref-${def.id}` }, "↩"),
              ),
            ),
          ),
        )
      : null,
  );
}

function renderMeta(ast: Document): ReactNode {
  const meta = ast.meta;
  if (!meta) return null;
  const has =
    meta.title ||
    (meta.authors && meta.authors.length > 0) ||
    meta.abstract ||
    (meta.keywords && meta.keywords.length > 0);
  if (!has) return null;

  return createElement(
    "header",
    { key: "meta" },
    meta.title ? createElement("h1", null, meta.title) : null,
    meta.authors && meta.authors.length > 0
      ? createElement(
          "p",
          { "data-authors": true },
          meta.authors
            .map(
              (a) =>
                `${a.name}${a.corresponding ? "*" : ""}${a.affiliation ? ` (${a.affiliation})` : ""}`,
            )
            .join(", "),
        )
      : null,
    meta.abstract
      ? createElement(
          "section",
          { "data-abstract": true },
          createElement("h2", null, "Abstract"),
          createElement("p", null, meta.abstract),
        )
      : null,
    meta.keywords && meta.keywords.length > 0
      ? createElement("p", { "data-keywords": true }, `Keywords: ${meta.keywords.join(", ")}`)
      : null,
  );
}

type Ctx = {
  assets: Record<string, string>;
  reviewMode: ReviewMode;
  bibliography: Document["bibliography"];
};

function renderBlock(node: BlockNode, key: number | string, ctx: Ctx): ReactNode {
  switch (node.type) {
    case "heading": {
      const level = Math.min(node.depth + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return createElement(
        tag,
        { key, id: node.id },
        ...node.children.map((c, i) => renderInline(c, i, ctx)),
      );
    }
    case "paragraph":
      return createElement("p", { key }, ...node.children.map((c, i) => renderInline(c, i, ctx)));
    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      return createElement(
        tag,
        { key, start: node.ordered ? node.start : undefined },
        ...node.children.map((item, i) =>
          createElement("li", { key: i }, ...item.children.map((c, j) => renderBlock(c, j, ctx))),
        ),
      );
    }
    case "blockquote":
      return createElement(
        "blockquote",
        { key },
        ...node.children.map((c, i) => renderBlock(c, i, ctx)),
      );
    case "code":
      return createElement(
        "pre",
        { key },
        createElement(
          "code",
          { className: node.lang ? `language-${node.lang}` : undefined },
          node.value,
        ),
      );
    case "thematicBreak":
      return createElement("hr", { key });
    case "figure": {
      const src = ctx.assets[node.src] ?? node.src;
      const caption = node.caption.length > 0 ? inlineText(node.caption) : "";
      return createElement(
        "figure",
        { key, id: node.id },
        src ? createElement("img", { src, alt: caption }) : null,
        caption
          ? createElement(
              "figcaption",
              null,
              ...node.caption.map((c, i) => renderInline(c, i, ctx)),
            )
          : null,
      );
    }
    case "tableDirective":
      return createElement(
        "figure",
        { key, id: node.id, "data-table": true },
        node.body
          ? createElement(Fragment, null, ...node.body.map((c, i) => renderBlock(c, i, ctx)))
          : null,
        createElement("figcaption", null, ...node.caption.map((c, i) => renderInline(c, i, ctx))),
      );
    case "table":
      return createElement(
        "table",
        { key },
        createElement("thead", null, renderTableRow(node.header, true, ctx)),
        createElement(
          "tbody",
          null,
          ...node.rows.map((row, i) => renderTableRow(row, false, ctx, i)),
        ),
      );
    case "references":
      return createElement(
        "section",
        { key, "data-references": true },
        createElement("h2", null, "References"),
        createElement(
          "ol",
          null,
          ...ctx.bibliography.map((entry) =>
            createElement("li", { key: entry.key, id: `ref-${entry.key}` }, formatBibEntry(entry)),
          ),
        ),
      );
    case "pagebreak":
      return createElement("hr", { key, "data-pagebreak": true });
    case "footnoteDefinition":
      return null;
    default:
      return null;
  }
}

function renderTableRow(row: TableRowNode, header: boolean, ctx: Ctx, key?: number): ReactNode {
  const tag = header ? "th" : "td";
  return createElement(
    "tr",
    { key },
    ...row.children.map((cell, i) =>
      createElement(tag, { key: i }, ...cell.children.map((c, j) => renderInline(c, j, ctx))),
    ),
  );
}

function renderInline(node: InlineNode, key: number | string, ctx: Ctx): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "strong":
      return createElement(
        "strong",
        { key },
        ...node.children.map((c, i) => renderInline(c, i, ctx)),
      );
    case "emphasis":
      return createElement("em", { key }, ...node.children.map((c, i) => renderInline(c, i, ctx)));
    case "link":
      return createElement(
        "a",
        { key, href: node.url, title: node.title },
        ...node.children.map((c, i) => renderInline(c, i, ctx)),
      );
    case "inlineCode":
      return createElement("code", { key }, node.value);
    case "strikethrough":
      return createElement("s", { key }, ...node.children.map((c, i) => renderInline(c, i, ctx)));
    case "break":
      return createElement("br", { key });
    case "cite":
      return createElement(
        "cite",
        { key },
        "[",
        ...node.keys.flatMap((k, i) => [
          i > 0 ? ", " : null,
          createElement("a", { key: k, href: `#ref-${k}` }, k),
        ]),
        "]",
      );
    case "ref":
      return createElement("a", { key, href: node.id ? `#${node.id}` : undefined }, node.label);
    case "footnoteRef":
      return createElement(
        "sup",
        { key, id: `fnref-${node.id}` },
        createElement("a", { href: `#fn-${node.id}` }, node.id),
      );
    case "addition":
      return renderReviewAddition(node, key, ctx);
    case "deletion":
      return renderReviewDeletion(node, key, ctx);
    case "substitution":
      return renderReviewSubstitution(node, key, ctx);
    case "highlight":
      return renderReviewHighlight(node, key, ctx);
    case "comment":
      return renderReviewComment(node, key, ctx);
    default:
      return null;
  }
}

function renderReviewAddition(
  node: Extract<InlineNode, { type: "addition" }>,
  key: number | string,
  ctx: Ctx,
): ReactNode {
  if (ctx.reviewMode === "clean") return null;
  if (ctx.reviewMode === "accepted") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    );
  }
  return createElement("ins", { key }, ...node.children.map((c, i) => renderInline(c, i, ctx)));
}

function renderReviewDeletion(
  node: Extract<InlineNode, { type: "deletion" }>,
  key: number | string,
  ctx: Ctx,
): ReactNode {
  if (ctx.reviewMode === "accepted") return null;
  if (ctx.reviewMode === "clean") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    );
  }
  return createElement("del", { key }, ...node.children.map((c, i) => renderInline(c, i, ctx)));
}

function renderReviewSubstitution(
  node: Extract<InlineNode, { type: "substitution" }>,
  key: number | string,
  ctx: Ctx,
): ReactNode {
  if (ctx.reviewMode === "clean") {
    return createElement(Fragment, { key }, ...node.old.map((c, i) => renderInline(c, i, ctx)));
  }
  if (ctx.reviewMode === "accepted") {
    return createElement(Fragment, { key }, ...node.new.map((c, i) => renderInline(c, i, ctx)));
  }
  return createElement(
    "span",
    { key, "data-substitution": true },
    createElement("del", null, ...node.old.map((c, i) => renderInline(c, i, ctx))),
    createElement("ins", null, ...node.new.map((c, i) => renderInline(c, i, ctx))),
  );
}

function renderReviewHighlight(
  node: Extract<InlineNode, { type: "highlight" }>,
  key: number | string,
  ctx: Ctx,
): ReactNode {
  if (ctx.reviewMode !== "markup") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    );
  }
  return createElement("mark", { key }, ...node.children.map((c, i) => renderInline(c, i, ctx)));
}

function renderReviewComment(
  node: Extract<InlineNode, { type: "comment" }>,
  key: number | string,
  ctx: Ctx,
): ReactNode {
  if (ctx.reviewMode !== "markup") return null;
  return createElement(
    "span",
    {
      key,
      "data-comment": true,
      "data-comment-id": node.meta?.id,
      "data-comment-by": node.meta?.by,
      title: node.text,
    },
    `[${node.meta?.by ?? "comment"}: ${node.text}]`,
  );
}

function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return n.value;
        case "strong":
        case "emphasis":
        case "link":
        case "strikethrough":
        case "addition":
        case "deletion":
        case "highlight":
          return inlineText(n.children);
        case "inlineCode":
          return n.value;
        case "substitution":
          return inlineText(n.old);
        default:
          return "";
      }
    })
    .join("");
}

function formatBibEntry(entry: Document["bibliography"][number]): string {
  const f = entry.fields;
  const author = f.author ?? "";
  const title = f.title ?? "";
  const year = f.year ?? "";
  const journal = f.journal ?? f.booktitle ?? "";
  const parts = [author, title && `"${title}"`, journal, year].filter(Boolean);
  return parts.join(". ") + (parts.length ? "." : entry.key);
}

function collectFootnotes(body: BlockNode[]): Extract<BlockNode, { type: "footnoteDefinition" }>[] {
  const defs: Extract<BlockNode, { type: "footnoteDefinition" }>[] = [];
  const walk = (blocks: BlockNode[]) => {
    for (const b of blocks) {
      if (b.type === "footnoteDefinition") defs.push(b);
      if (b.type === "list") {
        for (const item of b.children) walk(item.children);
      }
      if (b.type === "blockquote") walk(b.children);
      if (b.type === "tableDirective" && b.body) walk(b.body);
    }
  };
  walk(body);
  return defs;
}
