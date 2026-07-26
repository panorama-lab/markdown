import type { ReactElement, ReactNode } from "react";

import { Document as PdfDocument, Image, Link, Page, Text, View } from "@react-pdf/renderer";
import { createElement, Fragment } from "react";

import type {
  BlockNode,
  Document,
  HeadingFormat,
  InlineNode,
  RenderOptions,
  ReviewMode,
  TableRowNode,
} from "../ast.ts";

import { INCH, resolveFontFamily, resolveMargin } from "../styles.ts";

type ResolvedStyle = {
  assets: Record<string, string>;
  reviewMode: ReviewMode;
  bibliography: Document["bibliography"];
  pageSize: NonNullable<RenderOptions["pageSize"]>;
  margin: { top: number; right: number; bottom: number; left: number };
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphIndent: number;
  textAlign: "left" | "center" | "right" | "justify";
  titleAlign: "left" | "center" | "right";
  headings: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, HeadingFormat>>;
};

export function render(ast: Document, options?: RenderOptions): ReactElement {
  const style = resolveStyle(ast, options);
  const footnoteDefs = collectFootnotes(ast.body);

  return createElement(
    PdfDocument,
    {
      title: ast.meta?.title,
      author: ast.meta?.authors?.map((a) => a.name).join(", "),
      keywords: ast.meta?.keywords?.join(", "),
    },
    createElement(
      Page,
      {
        size: style.pageSize,
        style: {
          paddingTop: style.margin.top,
          paddingRight: style.margin.right,
          paddingBottom: style.margin.bottom,
          paddingLeft: style.margin.left,
          fontFamily: resolveFontFamily(style.fontFamily),
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
        },
        wrap: true,
      },
      renderMeta(ast, style),
      ...ast.body.map((node, i) => renderBlock(node, i, style)),
      footnoteDefs.length > 0
        ? createElement(
            View,
            { key: "footnotes", style: { marginTop: style.fontSize * style.lineHeight } },
            createElement(View, {
              style: {
                borderBottomWidth: 1,
                borderBottomColor: "#000",
                marginBottom: style.fontSize,
                width: 120,
              },
            }),
            ...footnoteDefs.map((def, i) =>
              createElement(
                View,
                { key: def.id, style: { marginBottom: style.fontSize * 0.5 } },
                createElement(
                  Text,
                  { style: { fontSize: style.fontSize - 2 } },
                  `${i + 1}. `,
                  ...def.children.flatMap((c, j) => {
                    if (c.type === "paragraph") {
                      return c.children.map((inline, k) =>
                        renderInline(inline, `${j}-${k}`, style),
                      );
                    }
                    return [renderBlock(c, j, style)];
                  }),
                ),
              ),
            ),
          )
        : null,
    ),
  );
}

function resolveStyle(ast: Document, options?: RenderOptions): ResolvedStyle {
  return {
    assets: options?.assets ?? {},
    reviewMode: options?.reviewMode ?? "accepted",
    bibliography: ast.bibliography,
    pageSize: options?.pageSize ?? "LETTER",
    margin: resolveMargin(options?.margin ?? 1),
    fontFamily: options?.fontFamily ?? "Times-Roman",
    fontSize: options?.fontSize ?? 12,
    lineHeight: options?.lineHeight ?? 2,
    paragraphIndent: (options?.paragraphIndent ?? 0.5) * INCH,
    textAlign: options?.textAlign ?? "left",
    titleAlign: options?.titleAlign ?? "center",
    headings: options?.headings ?? {},
  };
}

function renderMeta(ast: Document, style: ResolvedStyle): ReactNode {
  const meta = ast.meta;
  if (!meta) return null;
  const has =
    meta.title ||
    (meta.authors && meta.authors.length > 0) ||
    meta.abstract ||
    (meta.keywords && meta.keywords.length > 0);
  if (!has) return null;

  const titleFont = resolveFontFamily(style.fontFamily, "bold");

  return createElement(
    View,
    { key: "meta", style: { marginBottom: style.fontSize * style.lineHeight } },
    meta.title
      ? createElement(
          Text,
          {
            style: {
              fontFamily: titleFont,
              fontSize: style.fontSize,
              textAlign: style.titleAlign,
              marginBottom: style.fontSize * style.lineHeight,
            },
          },
          meta.title,
        )
      : null,
    meta.authors && meta.authors.length > 0
      ? createElement(
          Text,
          {
            style: {
              textAlign: style.titleAlign,
              marginBottom: style.fontSize * (style.lineHeight / 2),
            },
          },
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
          View,
          { style: { marginTop: style.fontSize * style.lineHeight } },
          createElement(
            Text,
            {
              style: {
                fontFamily: resolveFontFamily(style.fontFamily, "bold"),
                textAlign: "center",
                marginBottom: style.fontSize * (style.lineHeight / 2),
              },
            },
            "Abstract",
          ),
          createElement(
            Text,
            {
              style: {
                textAlign: style.textAlign,
              },
            },
            meta.abstract,
          ),
        )
      : null,
    meta.keywords && meta.keywords.length > 0
      ? createElement(
          Text,
          {
            style: {
              marginTop: style.fontSize * style.lineHeight,
              textAlign: style.textAlign,
            },
          },
          createElement(
            Text,
            { style: { fontFamily: resolveFontFamily(style.fontFamily, "bold") } },
            "Keywords: ",
          ),
          meta.keywords.join(", "),
        )
      : null,
  );
}

function renderBlock(node: BlockNode, key: number | string, style: ResolvedStyle): ReactNode {
  switch (node.type) {
    case "heading": {
      const depth = node.depth;
      const format = style.headings[depth] ?? defaultHeadingFormat(depth);
      const fontFamily = resolveFontFamily(
        format.fontFamily ?? style.fontFamily,
        format.fontWeight ?? "bold",
        format.fontStyle ?? "normal",
      );
      return createElement(
        Text,
        {
          key,
          id: node.id,
          style: {
            fontFamily,
            fontSize: format.fontSize ?? style.fontSize,
            textAlign: format.textAlign ?? "left",
            textTransform: format.textTransform === "none" ? undefined : format.textTransform,
            marginTop: format.marginTop ?? style.fontSize * style.lineHeight,
            marginBottom: format.marginBottom ?? style.fontSize * (style.lineHeight / 2),
            marginLeft: (format.indent ?? 0) * INCH,
            lineHeight: style.lineHeight,
          },
        },
        ...node.children.map((c, i) => renderInline(c, i, style)),
      );
    }
    case "paragraph":
      return createElement(
        Text,
        {
          key,
          style: {
            textAlign: style.textAlign,
            textIndent: style.paragraphIndent,
            marginBottom: 0,
            lineHeight: style.lineHeight,
          },
        },
        ...node.children.map((c, i) => renderInline(c, i, style)),
      );
    case "list": {
      return createElement(
        View,
        { key, style: { marginBottom: style.fontSize * (style.lineHeight / 2) } },
        ...node.children.map((item, i) => {
          const marker = node.ordered ? `${(node.start ?? 1) + i}.` : "•";
          return createElement(
            View,
            {
              key: i,
              style: {
                flexDirection: "row",
                marginBottom: style.fontSize * 0.25,
                paddingLeft: style.paragraphIndent,
              },
            },
            createElement(
              Text,
              { style: { width: style.fontSize * 1.5, lineHeight: style.lineHeight } },
              marker,
            ),
            createElement(
              View,
              { style: { flex: 1 } },
              ...item.children.map((c, j) => {
                if (c.type === "paragraph") {
                  return createElement(
                    Text,
                    {
                      key: j,
                      style: {
                        textAlign: style.textAlign,
                        lineHeight: style.lineHeight,
                        textIndent: 0,
                      },
                    },
                    ...c.children.map((inline, k) => renderInline(inline, k, style)),
                  );
                }
                return renderBlock(c, j, style);
              }),
            ),
          );
        }),
      );
    }
    case "blockquote":
      return createElement(
        View,
        {
          key,
          style: {
            marginLeft: style.paragraphIndent,
            marginBottom: style.fontSize * (style.lineHeight / 2),
            borderLeftWidth: 2,
            borderLeftColor: "#999",
            paddingLeft: style.fontSize,
          },
        },
        ...node.children.map((c, i) => renderBlock(c, i, style)),
      );
    case "code":
      return createElement(
        Text,
        {
          key,
          style: {
            fontFamily: "Courier",
            fontSize: style.fontSize - 1,
            lineHeight: 1.4,
            marginBottom: style.fontSize * (style.lineHeight / 2),
            backgroundColor: "#f5f5f5",
            padding: style.fontSize * 0.5,
          },
        },
        node.value,
      );
    case "thematicBreak":
      return createElement(View, {
        key,
        style: {
          borderBottomWidth: 1,
          borderBottomColor: "#000",
          marginVertical: style.fontSize * style.lineHeight,
        },
      });
    case "figure": {
      const src = style.assets[node.src] ?? node.src;
      const caption = node.caption.length > 0 ? inlineText(node.caption) : "";
      return createElement(
        View,
        {
          key,
          id: node.id,
          style: {
            marginVertical: style.fontSize * style.lineHeight,
            alignItems: "center",
          },
        },
        src
          ? createElement(Image, {
              src,
              style: { maxWidth: "100%", marginBottom: style.fontSize * 0.5 },
            })
          : null,
        caption
          ? createElement(
              Text,
              {
                style: {
                  fontSize: style.fontSize,
                  textAlign: "center",
                  lineHeight: style.lineHeight,
                },
              },
              ...node.caption.map((c, i) => renderInline(c, i, style)),
            )
          : null,
      );
    }
    case "tableDirective":
      return createElement(
        View,
        {
          key,
          id: node.id,
          style: { marginVertical: style.fontSize * style.lineHeight },
        },
        node.body
          ? createElement(Fragment, null, ...node.body.map((c, i) => renderBlock(c, i, style)))
          : null,
        createElement(
          Text,
          {
            style: {
              fontSize: style.fontSize,
              textAlign: "center",
              marginTop: style.fontSize * 0.5,
              lineHeight: style.lineHeight,
            },
          },
          ...node.caption.map((c, i) => renderInline(c, i, style)),
        ),
      );
    case "table":
      return createElement(
        View,
        { key, style: { marginVertical: style.fontSize * (style.lineHeight / 2) } },
        renderTableRow(node.header, true, style),
        ...node.rows.map((row, i) => renderTableRow(row, false, style, i)),
      );
    case "references":
      return createElement(
        View,
        { key, style: { marginTop: style.fontSize * style.lineHeight } },
        createElement(
          Text,
          {
            style: {
              fontFamily: resolveFontFamily(style.fontFamily, "bold"),
              textAlign: "center",
              marginBottom: style.fontSize * style.lineHeight,
              lineHeight: style.lineHeight,
            },
          },
          "References",
        ),
        ...style.bibliography.map((entry) =>
          createElement(
            Text,
            {
              key: entry.key,
              id: `ref-${entry.key}`,
              style: {
                textAlign: "left",
                marginBottom: 0,
                lineHeight: style.lineHeight,
                textIndent: -style.paragraphIndent,
                paddingLeft: style.paragraphIndent,
              },
            },
            formatBibEntry(entry),
          ),
        ),
      );
    case "pagebreak":
      return createElement(View, { key, break: true });
    case "footnoteDefinition":
      return null;
    default:
      return null;
  }
}

function renderTableRow(
  row: TableRowNode,
  header: boolean,
  style: ResolvedStyle,
  key?: number,
): ReactNode {
  return createElement(
    View,
    {
      key,
      style: {
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: "#333",
        paddingVertical: 2,
      },
    },
    ...row.children.map((cell, i) =>
      createElement(
        Text,
        {
          key: i,
          style: {
            flex: 1,
            fontFamily: header
              ? resolveFontFamily(style.fontFamily, "bold")
              : resolveFontFamily(style.fontFamily),
            fontSize: style.fontSize - 1,
            paddingRight: 4,
            lineHeight: 1.4,
          },
        },
        ...cell.children.map((c, j) => renderInline(c, j, style)),
      ),
    ),
  );
}

function renderInline(node: InlineNode, key: number | string, style: ResolvedStyle): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "strong":
      return createElement(
        Text,
        { key, style: { fontFamily: resolveFontFamily(style.fontFamily, "bold") } },
        ...node.children.map((c, i) => renderInline(c, i, style)),
      );
    case "emphasis":
      return createElement(
        Text,
        { key, style: { fontFamily: resolveFontFamily(style.fontFamily, "normal", "italic") } },
        ...node.children.map((c, i) => renderInline(c, i, style)),
      );
    case "link":
      return createElement(
        Link,
        { key, src: node.url },
        ...node.children.map((c, i) => renderInline(c, i, style)),
      );
    case "inlineCode":
      return createElement(
        Text,
        { key, style: { fontFamily: "Courier", fontSize: style.fontSize - 1 } },
        node.value,
      );
    case "strikethrough":
      return createElement(
        Text,
        { key, style: { textDecoration: "line-through" } },
        ...node.children.map((c, i) => renderInline(c, i, style)),
      );
    case "break":
      return "\n";
    case "cite":
      return createElement(
        Text,
        { key },
        "[",
        ...node.keys.flatMap((k, i) => [i > 0 ? ", " : null, k]),
        "]",
      );
    case "ref":
      return createElement(Text, { key }, node.label);
    case "footnoteRef":
      return createElement(
        Text,
        { key, style: { fontSize: style.fontSize - 3, verticalAlign: "super" } },
        node.id,
      );
    case "addition":
      return renderReviewAddition(node, key, style);
    case "deletion":
      return renderReviewDeletion(node, key, style);
    case "substitution":
      return renderReviewSubstitution(node, key, style);
    case "highlight":
      return renderReviewHighlight(node, key, style);
    case "comment":
      return renderReviewComment(node, key, style);
    default:
      return null;
  }
}

function renderReviewAddition(
  node: Extract<InlineNode, { type: "addition" }>,
  key: number | string,
  style: ResolvedStyle,
): ReactNode {
  if (style.reviewMode === "clean") return null;
  if (style.reviewMode === "accepted") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, style)),
    );
  }
  return createElement(
    Text,
    { key, style: { color: "#0a0", textDecoration: "underline" } },
    ...node.children.map((c, i) => renderInline(c, i, style)),
  );
}

function renderReviewDeletion(
  node: Extract<InlineNode, { type: "deletion" }>,
  key: number | string,
  style: ResolvedStyle,
): ReactNode {
  if (style.reviewMode === "accepted") return null;
  if (style.reviewMode === "clean") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, style)),
    );
  }
  return createElement(
    Text,
    { key, style: { color: "#a00", textDecoration: "line-through" } },
    ...node.children.map((c, i) => renderInline(c, i, style)),
  );
}

function renderReviewSubstitution(
  node: Extract<InlineNode, { type: "substitution" }>,
  key: number | string,
  style: ResolvedStyle,
): ReactNode {
  if (style.reviewMode === "clean") {
    return createElement(Fragment, { key }, ...node.old.map((c, i) => renderInline(c, i, style)));
  }
  if (style.reviewMode === "accepted") {
    return createElement(Fragment, { key }, ...node.new.map((c, i) => renderInline(c, i, style)));
  }
  return createElement(
    Text,
    { key },
    createElement(
      Text,
      { style: { color: "#a00", textDecoration: "line-through" } },
      ...node.old.map((c, i) => renderInline(c, i, style)),
    ),
    " ",
    createElement(
      Text,
      { style: { color: "#0a0", textDecoration: "underline" } },
      ...node.new.map((c, i) => renderInline(c, i, style)),
    ),
  );
}

function renderReviewHighlight(
  node: Extract<InlineNode, { type: "highlight" }>,
  key: number | string,
  style: ResolvedStyle,
): ReactNode {
  if (style.reviewMode !== "markup") {
    return createElement(
      Fragment,
      { key },
      ...node.children.map((c, i) => renderInline(c, i, style)),
    );
  }
  return createElement(
    Text,
    { key, style: { backgroundColor: "#ff0" } },
    ...node.children.map((c, i) => renderInline(c, i, style)),
  );
}

function renderReviewComment(
  node: Extract<InlineNode, { type: "comment" }>,
  key: number | string,
  style: ResolvedStyle,
): ReactNode {
  if (style.reviewMode !== "markup") return null;
  return createElement(
    Text,
    { key, style: { color: "#06c", fontSize: style.fontSize - 1 } },
    ` [${node.meta?.by ?? "comment"}: ${node.text}]`,
  );
}

function defaultHeadingFormat(depth: 1 | 2 | 3 | 4 | 5 | 6): HeadingFormat {
  if (depth === 1) return { fontWeight: "bold", textAlign: "center" };
  if (depth === 2) return { fontWeight: "bold", textAlign: "left" };
  if (depth === 3) return { fontWeight: "bold", fontStyle: "italic", textAlign: "left" };
  return { fontWeight: "bold", textAlign: "left", indent: 0.5 };
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
