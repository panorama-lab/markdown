import type { ReactNode } from "react";

import { createElement, Fragment } from "react";

import type {
  BibEntry,
  BlockNode,
  Document,
  InlineNode,
  RenderOptions,
  ReviewMode,
  TableRowNode,
} from "../ast.ts";

import { resolveCitationStyle, type CitationStyle } from "../citation.ts";
import { collectHeadings, headingSlug, inlineText, type TocEntry } from "./headings.ts";

export function render(ast: Document, options?: RenderOptions): ReactNode {
  const assets = options?.assets ?? {};
  const reviewMode: ReviewMode = options?.reviewMode ?? "markup";
  const citationStyle = resolveCitationStyle(options?.citationStyle);
  const bibByKey = new Map(ast.bibliography.map((entry) => [entry.key, entry]));
  const footnoteDefs = collectFootnotes(ast.body);
  const toc = ast.body.some((b) => b.type === "tableOfContents") ? collectHeadings(ast.body) : [];
  const ctx: Ctx = {
    assets,
    reviewMode,
    bibliography: ast.bibliography,
    citationStyle,
    bibByKey,
    toc,
    reviewSeq: 0,
  };

  return createElement(
    "article",
    null,
    renderMeta(ast),
    ...ast.body.map((node, i) => renderBlock(node, i, ctx)),
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
                ...def.children.map((c, i) => renderBlock(c, i, ctx)),
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
  citationStyle: CitationStyle;
  bibByKey: Map<string, BibEntry>;
  toc: TocEntry[];
  reviewSeq: number;
};

function renderBlock(node: BlockNode, key: number | string, ctx: Ctx): ReactNode {
  switch (node.type) {
    case "heading": {
      const level = Math.min(node.depth + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return createElement(
        tag,
        { key, id: node.id ?? headingSlug(inlineText(node.children)) },
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
            createElement(
              "li",
              { key: entry.key, id: `ref-${entry.key}` },
              ...ctx.citationStyle
                .reference(entry)
                .map((run, i) =>
                  run.italic ? createElement("em", { key: i }, run.text) : run.text,
                ),
            ),
          ),
        ),
      );
    case "pagebreak":
      return createElement("hr", { key, "data-pagebreak": true });
    case "tableOfContents": {
      const entries = ctx.toc.filter((h) => h.depth <= node.levels);
      return createElement(
        "nav",
        { key, id: node.id, "data-toc": true },
        node.title ? createElement("h2", null, node.title) : null,
        entries.length > 0 ? createElement("ul", null, ...renderTocItems(entries)) : null,
      );
    }
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
    case "cite": {
      const segments = ctx.citationStyle.inText(node.keys, (k) => ctx.bibByKey.get(k));
      return createElement(
        "cite",
        { key },
        ...segments.map((segment, i) =>
          segment.key
            ? createElement("a", { key: i, href: `#ref-${segment.key}` }, segment.text)
            : segment.text,
        ),
      );
    }
    case "ref":
      return createElement("a", { key, href: node.id ? `#${node.id}` : undefined }, node.label);
    case "footnoteRef":
      return createElement(
        "sup",
        { key, id: `fnref-${node.id}` },
        createElement("a", { href: `#fn-${node.id}` }, node.id),
      );
    case "addition":
      return renderReviewAddition(node, key, ctx, node.review?.id ?? String(ctx.reviewSeq++));
    case "deletion":
      return renderReviewDeletion(node, key, ctx, node.review?.id ?? String(ctx.reviewSeq++));
    case "substitution":
      return renderReviewSubstitution(node, key, ctx, node.review?.id ?? String(ctx.reviewSeq++));
    case "comment":
      return renderReviewComment(node, key, ctx, node.review?.id ?? String(ctx.reviewSeq++));
    default:
      return null;
  }
}

function reviewProps(kind: string, id?: string): Record<string, string> {
  return { "data-review": kind, ...(id !== undefined ? { "data-review-id": id } : {}) };
}

function renderReviewAddition(
  node: Extract<InlineNode, { type: "addition" }>,
  key: number | string,
  ctx: Ctx,
  id: string,
): ReactNode {
  if (ctx.reviewMode === "clean") return null;
  if (ctx.reviewMode === "accepted") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    );
  }
  return createElement(
    Fragment,
    { key },
    createElement(
      "ins",
      reviewProps("addition", id),
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    ),
  );
}

function renderReviewDeletion(
  node: Extract<InlineNode, { type: "deletion" }>,
  key: number | string,
  ctx: Ctx,
  id: string,
): ReactNode {
  if (ctx.reviewMode === "accepted") return null;
  if (ctx.reviewMode === "clean") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    );
  }
  return createElement(
    Fragment,
    { key },
    createElement(
      "del",
      reviewProps("deletion", id),
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    ),
  );
}

function renderReviewSubstitution(
  node: Extract<InlineNode, { type: "substitution" }>,
  key: number | string,
  ctx: Ctx,
  id: string,
): ReactNode {
  if (ctx.reviewMode === "clean") {
    return createElement(Fragment, { key }, ...node.old.map((c, i) => renderInline(c, i, ctx)));
  }
  if (ctx.reviewMode === "accepted") {
    return createElement(Fragment, { key }, ...node.new.map((c, i) => renderInline(c, i, ctx)));
  }
  return createElement(
    Fragment,
    { key },
    createElement(
      "span",
      { "data-substitution": true, ...reviewProps("substitution", id) },
      createElement("del", null, ...node.old.map((c, i) => renderInline(c, i, ctx))),
      " → ",
      createElement("ins", null, ...node.new.map((c, i) => renderInline(c, i, ctx))),
    ),
  );
}

function renderReviewComment(
  node: Extract<InlineNode, { type: "comment" }>,
  key: number | string,
  ctx: Ctx,
  id: string,
): ReactNode {
  if (ctx.reviewMode !== "markup")
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, ctx)),
    );
  return createElement(
    "span",
    {
      key,
      ...reviewProps("comment", id),
      "data-comment": true,
    },
    ...node.children.map((c, i) => renderInline(c, i, ctx)),
  );
}

function renderTocItems(entries: TocEntry[]): ReactNode[] {
  const items: ReactNode[] = [];
  let i = 0;
  const depth = entries[0]?.depth ?? 1;
  while (i < entries.length) {
    const entry = entries[i];
    if (entry.depth < depth) break;
    let j = i + 1;
    while (j < entries.length && entries[j].depth > depth) j += 1;
    const children = entries.slice(i + 1, j);
    items.push(
      createElement(
        "li",
        { key: entry.id },
        createElement("a", { href: `#${entry.id}` }, entry.text),
        children.length > 0 ? createElement("ul", null, ...renderTocItems(children)) : null,
      ),
    );
    i = j;
  }
  return items;
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
