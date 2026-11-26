import type { ReactNode } from "react";

import { createElement, Fragment } from "react";

import type {
  BibEntry,
  BlockNode,
  Document,
  FrontMatter,
  InlineNode,
  RenderOptions,
  ReviewMode,
  TableRowNode,
} from "../ast.ts";

import { resolveCitationStyle, type CitationStyle } from "../citation.ts";
import { collectHeadings, headingSlug, inlineText, type TocEntry } from "./headings.ts";
import { TableOfContentsLayout } from "./toc-layout.ts";

export type TableOfContentsLink = Pick<TocEntry, "id" | "depth"> & { label: ReactNode };

export type ReactRenderOptions = RenderOptions & {
  tableOfContents?:
    | boolean
    | "collapsed"
    | ((links: TableOfContentsLink[], article: ReactNode) => ReactNode);
  scrollableTables?: boolean;
  renderHeader?: (meta: FrontMatter | null) => ReactNode;
};

export type RenderMath = (value: string, display: boolean, key: number | string) => ReactNode;

export function render(
  ast: Document,
  options: ReactRenderOptions | undefined,
  renderMath: RenderMath,
): ReactNode {
  const assets = options?.assets ?? {};
  const reviewMode: ReviewMode = options?.reviewMode ?? "markup";
  const citationStyle = resolveCitationStyle(options?.citationStyle);
  const bibByKey = new Map(ast.bibliography.map((entry) => [entry.key, entry]));
  const { definitions: footnoteDefs, documentScope, tableScopes } = collectFootnotes(ast.body);
  const headingIds = new Map<BlockNode, string>();
  const toc = collectHeadings(ast.body, headingIds);
  const ctx: Ctx = {
    assets,
    renderMath,
    reviewMode,
    bibliography: ast.bibliography,
    citationStyle,
    bibByKey,
    toc,
    reviewSequence: { next: 0 },
    headingIds,
    scrollableTables: options?.scrollableTables ?? false,
    footnoteScope: documentScope,
    tableScopes,
    footnoteReferences: new Set(),
  };

  const article = createElement(
    "article",
    null,
    options?.renderHeader ? options.renderHeader(ast.meta) : renderMeta(ast),
    ...ast.body.map((node, i) => renderBlock(node, i, ctx)),
    footnoteDefs.length > 0
      ? createElement(
          "section",
          { key: "footnotes", "data-footnotes": true },
          createElement("hr"),
          createElement(
            "ol",
            null,
            ...footnoteDefs.map(({ node, anchor, scope }) =>
              createElement(
                "li",
                { key: anchor, id: `fn-${anchor}` },
                ...node.children.map((c, i) => renderBlock(c, i, { ...ctx, footnoteScope: scope })),
                createElement("a", { href: `#fnref-${anchor}` }, "↩"),
              ),
            ),
          ),
        )
      : null,
  );
  const contents = options?.tableOfContents;
  if (!contents || !toc.length) return article;
  if (typeof contents === "function") {
    return contents(
      toc.map((entry) => ({
        id: entry.id,
        depth: entry.depth,
        label: renderTocLabel(entry, renderMath),
      })),
      article,
    );
  }
  return createElement(TableOfContentsLayout, {
    entries: toc,
    renderLabel: (entry: TocEntry) => renderTocLabel(entry, renderMath),
    defaultExpanded: contents !== "collapsed",
    children: article,
  });
}

function renderMeta(ast: Document): ReactNode {
  const meta = ast.meta;
  if (!meta) return null;
  const doi = meta.doi?.trim();
  const has =
    meta.title ||
    doi ||
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
    doi
      ? createElement(
          "p",
          { "data-doi": true },
          "DOI: ",
          createElement(
            "a",
            {
              href: `https://doi.org/${doi.split("/").map(encodeURIComponent).join("/")}`,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            doi,
          ),
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
  renderMath: RenderMath;
  assets: Record<string, string>;
  reviewMode: ReviewMode;
  bibliography: Document["bibliography"];
  citationStyle: CitationStyle;
  bibByKey: Map<string, BibEntry>;
  toc: TocEntry[];
  headingIds: Map<BlockNode, string>;
  reviewSequence: { next: number };
  scrollableTables: boolean;
  footnoteScope: FootnoteScope;
  tableScopes: Map<BlockNode, FootnoteScope>;
  footnoteReferences: Set<string>;
};

function renderBlock(node: BlockNode, key: number | string, ctx: Ctx): ReactNode {
  switch (node.type) {
    case "heading": {
      const level = Math.min(node.depth + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return createElement(
        tag,
        { key, id: ctx.headingIds.get(node) ?? node.id ?? headingSlug(inlineText(node.children)) },
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
    case "displayMath":
      return createElement(
        "div",
        {
          key,
          id: node.id,
          style: node.number
            ? { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "1em" }
            : undefined,
        },
        ctx.renderMath(node.value, true, key),
        node.number ? createElement("span", null, `(${node.number})`) : null,
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
    case "tableDirective": {
      const tableCtx = { ...ctx, footnoteScope: ctx.tableScopes.get(node) ?? ctx.footnoteScope };
      return createElement(
        "figure",
        { key, id: node.id, "data-table": true },
        node.body
          ? createElement(Fragment, null, ...node.body.map((c, i) => renderBlock(c, i, tableCtx)))
          : null,
        createElement(
          "figcaption",
          null,
          ...node.caption.map((c, i) => renderInline(c, i, tableCtx)),
        ),
      );
    }
    case "table": {
      const table = createElement(
        "table",
        { key },
        createElement("thead", null, renderTableRow(node.header, true, ctx)),
        createElement(
          "tbody",
          null,
          ...node.rows.map((row, i) => renderTableRow(row, false, ctx, i)),
        ),
      );
      return ctx.scrollableTables
        ? createElement(
            "div",
            { key, tabIndex: 0, role: "region", "aria-label": "Table", "data-table-scroll": true },
            table,
          )
        : table;
    }
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
        entries.length > 0
          ? createElement("ul", null, ...renderTocItems(entries, ctx.renderMath))
          : null,
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
    case "inlineMath":
      return ctx.renderMath(node.value, false, key);
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
    case "footnoteRef": {
      let scope: FootnoteScope | undefined = ctx.footnoteScope;
      let anchor: string | undefined;
      while (scope && anchor === undefined) {
        anchor = scope.anchors.get(node.id);
        scope = scope.parent;
      }
      if (anchor === undefined) return createElement("sup", { key }, node.id);
      const firstReference = !ctx.footnoteReferences.has(anchor);
      ctx.footnoteReferences.add(anchor);
      return createElement(
        "sup",
        { key, id: firstReference ? `fnref-${anchor}` : undefined },
        createElement("a", { href: `#fn-${anchor}` }, node.id),
      );
    }
    case "addition":
      return renderReviewAddition(
        node,
        key,
        ctx,
        node.review?.id ?? String(ctx.reviewSequence.next++),
      );
    case "deletion":
      return renderReviewDeletion(
        node,
        key,
        ctx,
        node.review?.id ?? String(ctx.reviewSequence.next++),
      );
    case "substitution":
      return renderReviewSubstitution(
        node,
        key,
        ctx,
        node.review?.id ?? String(ctx.reviewSequence.next++),
      );
    case "comment":
      return renderReviewComment(
        node,
        key,
        ctx,
        node.review?.id ?? String(ctx.reviewSequence.next++),
      );
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

function renderTocLabel(entry: TocEntry, renderMath: RenderMath): ReactNode {
  return entry.label.map((part, i) =>
    part.type === "inlineMath" ? renderMath(part.value, false, i) : part.value,
  );
}

function renderTocItems(entries: TocEntry[], renderMath: RenderMath): ReactNode[] {
  const items: ReactNode[] = [];
  let i = 0;
  const depth = Math.min(...entries.map((entry) => entry.depth));
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
        createElement("a", { href: `#${entry.id}` }, renderTocLabel(entry, renderMath)),
        children.length > 0
          ? createElement("ul", null, ...renderTocItems(children, renderMath))
          : null,
      ),
    );
    i = j;
  }
  return items;
}

type FootnoteScope = {
  anchors: Map<string, string>;
  parent?: FootnoteScope;
};

function collectFootnotes(body: BlockNode[]) {
  const documentScope: FootnoteScope = { anchors: new Map() };
  const tableScopes = new Map<BlockNode, FootnoteScope>();
  const notes: {
    node: Extract<BlockNode, { type: "footnoteDefinition" }>;
    scope: FootnoteScope;
  }[] = [];
  const walk = (blocks: BlockNode[], scope: FootnoteScope) => {
    for (const b of blocks) {
      if (b.type === "footnoteDefinition") notes.push({ node: b, scope });
      if (b.type === "list") {
        for (const item of b.children) walk(item.children, scope);
      }
      if (b.type === "blockquote") walk(b.children, scope);
      if (b.type === "tableDirective" && b.body) {
        const tableScope: FootnoteScope = { anchors: new Map(), parent: scope };
        tableScopes.set(b, tableScope);
        walk(b.body, tableScope);
      }
    }
  };
  walk(body, documentScope);

  const labels = new Set(notes.map(({ node }) => node.id));
  const documentLabels = new Set(
    notes.filter(({ scope }) => scope === documentScope).map(({ node }) => node.id),
  );
  const used = new Set<string>();
  const definitions = notes.map(({ node, scope }) => {
    let anchor = node.id;
    if (used.has(anchor) || (scope !== documentScope && documentLabels.has(anchor))) {
      let suffix = 2;
      do {
        anchor = `${node.id}-${suffix++}`;
      } while (used.has(anchor) || labels.has(anchor));
    }
    used.add(anchor);
    if (!scope.anchors.has(node.id)) scope.anchors.set(node.id, anchor);
    return { node, scope, anchor };
  });

  return { definitions, documentScope, tableScopes };
}
