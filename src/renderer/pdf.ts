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

import { INCH, resolveFontFamily, resolveMargin, resolvePageSize } from "../styles.ts";
import { collectHeadings, headingSlug, inlineText, type TocEntry } from "./headings.ts";

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
  titleFontSize: number;
  keywordsLabel: string;
  columns: number;
  columnGap: number;
  headings: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, HeadingFormat>>;
  toc: TocEntry[];
};

type LayoutItem = {
  key: string;
  height: number;
  breakBefore?: boolean;
  node: ReactNode;
};

export function render(ast: Document, options?: RenderOptions): ReactElement {
  const style = resolveStyle(ast, options);
  if (style.columns > 1) {
    return renderMultiColumn(ast, style);
  }
  return renderSingleColumn(ast, style);
}

function renderSingleColumn(ast: Document, style: ResolvedStyle): ReactElement {
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
        style: pageStyle(style),
        wrap: true,
      },
      renderMeta(ast, style, { includeAbstract: true, includeKeywords: true }),
      ...ast.body.map((node, i) => renderBlock(node, i, style)),
      renderFootnotes(footnoteDefs, style),
    ),
  );
}

function renderMultiColumn(ast: Document, style: ResolvedStyle): ReactElement {
  const page = resolvePageSize(style.pageSize);
  const contentWidth = page.width - style.margin.left - style.margin.right;
  const contentHeight = page.height - style.margin.top - style.margin.bottom;
  const gap = style.columnGap;
  const columnWidth = (contentWidth - gap * (style.columns - 1)) / style.columns;
  const titleHeight = estimateTitleBlockHeight(ast, style);
  const firstPageColumnHeight = Math.max(
    contentHeight - titleHeight - style.fontSize * 2,
    style.fontSize * 8,
  );
  const fullPageColumnHeight = contentHeight - style.fontSize;

  const items = buildColumnItems(ast, style, columnWidth);
  const pages = packColumnPages(items, style.columns, firstPageColumnHeight, fullPageColumnHeight);

  return createElement(
    PdfDocument,
    {
      title: ast.meta?.title,
      author: ast.meta?.authors?.map((a) => a.name).join(", "),
      keywords: ast.meta?.keywords?.join(", "),
    },
    ...pages.map((columns, pageIndex) =>
      createElement(
        Page,
        {
          key: `page-${pageIndex}`,
          size: style.pageSize,
          style: pageStyle(style),
          wrap: false,
        },
        pageIndex === 0
          ? renderMeta(ast, style, { includeAbstract: false, includeKeywords: false })
          : null,
        createElement(
          View,
          {
            style: {
              flexDirection: "row",
              columnGap: gap,
              width: contentWidth,
            },
          },
          ...columns.map((columnItems, columnIndex) =>
            createElement(
              View,
              {
                key: `col-${pageIndex}-${columnIndex}`,
                style: {
                  width: columnWidth,
                  flexGrow: 0,
                  flexShrink: 0,
                },
              },
              ...columnItems.map((item) => item.node),
            ),
          ),
        ),
      ),
    ),
  );
}

function pageStyle(style: ResolvedStyle) {
  return {
    paddingTop: style.margin.top,
    paddingRight: style.margin.right,
    paddingBottom: style.margin.bottom,
    paddingLeft: style.margin.left,
    fontFamily: resolveFontFamily(style.fontFamily),
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
  };
}

function resolveStyle(ast: Document, options?: RenderOptions): ResolvedStyle {
  const fontSize = options?.fontSize ?? 12;
  return {
    assets: options?.assets ?? {},
    reviewMode: options?.reviewMode ?? "accepted",
    bibliography: ast.bibliography,
    pageSize: options?.pageSize ?? "LETTER",
    margin: resolveMargin(options?.margin ?? 1),
    fontFamily: options?.fontFamily ?? "Times-Roman",
    fontSize,
    lineHeight: options?.lineHeight ?? 2,
    paragraphIndent: (options?.paragraphIndent ?? 0.5) * INCH,
    textAlign: options?.textAlign ?? "left",
    titleAlign: options?.titleAlign ?? "center",
    titleFontSize: options?.titleFontSize ?? fontSize,
    keywordsLabel: options?.keywordsLabel ?? "Keywords",
    columns: Math.max(1, Math.floor(options?.columns ?? 1)),
    columnGap: (options?.columnGap ?? 0.25) * INCH,
    headings: options?.headings ?? {},
    toc: collectHeadings(ast.body),
  };
}

function renderMeta(
  ast: Document,
  style: ResolvedStyle,
  options: { includeAbstract: boolean; includeKeywords: boolean },
): ReactNode {
  const meta = ast.meta;
  if (!meta) return null;
  const hasTitle = Boolean(meta.title);
  const hasAuthors = Boolean(meta.authors && meta.authors.length > 0);
  const hasAbstract = options.includeAbstract && Boolean(meta.abstract);
  const hasKeywords = options.includeKeywords && Boolean(meta.keywords && meta.keywords.length > 0);
  if (!hasTitle && !hasAuthors && !hasAbstract && !hasKeywords) return null;

  const titleFont = resolveFontFamily(style.fontFamily, "bold");

  return createElement(
    View,
    { key: "meta", style: { marginBottom: style.fontSize * style.lineHeight } },
    hasTitle
      ? createElement(
          Text,
          {
            style: {
              fontFamily: titleFont,
              fontSize: style.titleFontSize,
              textAlign: style.titleAlign,
              marginBottom: style.fontSize * style.lineHeight,
            },
          },
          meta.title,
        )
      : null,
    hasAuthors
      ? createElement(
          Text,
          {
            style: {
              textAlign: style.titleAlign,
              marginBottom: style.fontSize * (style.lineHeight / 2),
            },
          },
          meta
            .authors!.map(
              (a) =>
                `${a.name}${a.corresponding ? "*" : ""}${a.affiliation ? ` (${a.affiliation})` : ""}`,
            )
            .join(", "),
        )
      : null,
    hasAbstract ? renderAbstractBlock(meta.abstract!, style, "meta-abstract") : null,
    hasKeywords ? renderKeywordsBlock(meta.keywords!, style, "meta-keywords") : null,
  );
}

function renderAbstractBlock(abstract: string, style: ResolvedStyle, key: string): ReactNode {
  return createElement(
    View,
    { key, style: { marginTop: style.fontSize * style.lineHeight } },
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
          fontFamily: resolveFontFamily(style.fontFamily, "normal", "italic"),
        },
      },
      abstract,
    ),
  );
}

function renderKeywordsBlock(keywords: string[], style: ResolvedStyle, key: string): ReactNode {
  const separator = style.keywordsLabel === "Index Terms" ? "—" : ": ";
  return createElement(
    Text,
    {
      key,
      style: {
        marginTop: style.fontSize * style.lineHeight,
        textAlign: style.textAlign,
      },
    },
    createElement(
      Text,
      { style: { fontFamily: resolveFontFamily(style.fontFamily, "bold") } },
      `${style.keywordsLabel}${separator}`,
    ),
    keywords.join(", "),
  );
}

function buildColumnItems(ast: Document, style: ResolvedStyle, columnWidth: number): LayoutItem[] {
  const items: LayoutItem[] = [];
  const meta = ast.meta;

  if (meta?.abstract) {
    items.push({
      key: "abstract",
      height: estimateAbstractHeight(meta.abstract, style, columnWidth),
      node: renderAbstractBlock(meta.abstract, style, "abstract"),
    });
  }

  if (meta?.keywords && meta.keywords.length > 0) {
    items.push({
      key: "keywords",
      height: estimateKeywordsHeight(meta.keywords, style, columnWidth),
      node: renderKeywordsBlock(meta.keywords, style, "keywords"),
    });
  }

  for (let i = 0; i < ast.body.length; i++) {
    const node = ast.body[i]!;
    if (node.type === "pagebreak") {
      items.push({
        key: `break-${i}`,
        height: 0,
        breakBefore: true,
        node: null,
      });
      continue;
    }
    if (node.type === "footnoteDefinition") continue;
    items.push({
      key: `block-${i}`,
      height: estimateBlockHeight(node, style, columnWidth),
      node: renderBlock(node, i, style),
    });
  }

  const footnoteDefs = collectFootnotes(ast.body);
  if (footnoteDefs.length > 0) {
    items.push({
      key: "footnotes",
      height: estimateFootnotesHeight(footnoteDefs, style, columnWidth),
      node: renderFootnotes(footnoteDefs, style),
    });
  }

  return items;
}

function packColumnPages(
  items: LayoutItem[],
  columnCount: number,
  firstPageColumnHeight: number,
  fullPageColumnHeight: number,
): LayoutItem[][][] {
  const pages: LayoutItem[][][] = [];
  let index = 0;
  let pageIndex = 0;

  while (index < items.length || (pageIndex === 0 && items.length === 0)) {
    const columnHeight = pageIndex === 0 ? firstPageColumnHeight : fullPageColumnHeight;
    const columns: LayoutItem[][] = Array.from({ length: columnCount }, () => []);
    const used = Array.from({ length: columnCount }, () => 0);
    let column = 0;
    let packedAny = false;

    if (index < items.length && items[index]!.breakBefore && pageIndex > 0) {
      index += 1;
    }

    while (index < items.length && column < columnCount) {
      const item = items[index]!;

      if (item.breakBefore) {
        if (packedAny) break;
        index += 1;
        continue;
      }

      const remaining = columnHeight - used[column]!;
      if (item.height > remaining && used[column]! > 0) {
        column += 1;
        continue;
      }

      columns[column]!.push(item);
      used[column]! += Math.max(item.height, 1);
      index += 1;
      packedAny = true;

      if (used[column]! >= columnHeight) {
        column += 1;
      }
    }

    if (!packedAny && index < items.length) {
      columns[0]!.push(items[index]!);
      index += 1;
      packedAny = true;
    }

    pages.push(columns);

    if (!packedAny) break;
    pageIndex += 1;
    if (pageIndex > 200) break;
  }

  if (pages.length === 0) {
    pages.push(Array.from({ length: columnCount }, () => []));
  }

  return pages;
}

function estimateTitleBlockHeight(ast: Document, style: ResolvedStyle): number {
  const meta = ast.meta;
  if (!meta) return 0;
  let height = style.fontSize * style.lineHeight;
  if (meta.title) {
    const lines = Math.max(1, Math.ceil(meta.title.length / 48));
    height += lines * style.titleFontSize * 1.2 + style.fontSize * style.lineHeight;
  }
  if (meta.authors && meta.authors.length > 0) {
    const authorText = meta.authors.map((a) => a.name).join(", ");
    const lines = Math.max(1, Math.ceil(authorText.length / 60));
    height += lines * style.fontSize * style.lineHeight + style.fontSize * (style.lineHeight / 2);
  }
  return height;
}

function estimateAbstractHeight(
  abstract: string,
  style: ResolvedStyle,
  columnWidth: number,
): number {
  const heading = style.fontSize * style.lineHeight;
  const body = estimateTextHeight(abstract, style, columnWidth);
  return heading + body + style.fontSize * style.lineHeight;
}

function estimateKeywordsHeight(
  keywords: string[],
  style: ResolvedStyle,
  columnWidth: number,
): number {
  const separator = style.keywordsLabel === "Index Terms" ? "—" : ": ";
  const text = `${style.keywordsLabel}${separator}${keywords.join(", ")}`;
  return estimateTextHeight(text, style, columnWidth) + style.fontSize * style.lineHeight;
}

function estimateFootnotesHeight(
  defs: Extract<BlockNode, { type: "footnoteDefinition" }>[],
  style: ResolvedStyle,
  columnWidth: number,
): number {
  let height = style.fontSize * style.lineHeight + style.fontSize + 8;
  for (const def of defs) {
    const text = def.children
      .filter((c): c is Extract<BlockNode, { type: "paragraph" }> => c.type === "paragraph")
      .map((c) => inlineText(c.children))
      .join(" ");
    height += estimateTextHeight(text, style, columnWidth, style.fontSize - 2);
  }
  return height;
}

function estimateBlockHeight(node: BlockNode, style: ResolvedStyle, columnWidth: number): number {
  const line = style.fontSize * style.lineHeight;
  switch (node.type) {
    case "heading": {
      const format = style.headings[node.depth] ?? defaultHeadingFormat(node.depth);
      const fontSize = format.fontSize ?? style.fontSize;
      const text = inlineText(node.children);
      const lines = Math.max(1, Math.ceil((text.length * fontSize * 0.55) / columnWidth));
      return (
        (format.marginTop ?? line) +
        lines * fontSize * style.lineHeight * 1.1 +
        (format.marginBottom ?? line / 2)
      );
    }
    case "paragraph":
      return estimateTextHeight(inlineText(node.children), style, columnWidth) + line * 0.15;
    case "list": {
      let height = line / 2;
      for (const item of node.children) {
        const text = item.children
          .filter((c): c is Extract<BlockNode, { type: "paragraph" }> => c.type === "paragraph")
          .map((c) => inlineText(c.children))
          .join(" ");
        height +=
          estimateTextHeight(text, style, columnWidth - style.fontSize * 1.5) +
          style.fontSize * 0.4;
      }
      return height;
    }
    case "blockquote":
      return (
        node.children.reduce(
          (sum, child) => sum + estimateBlockHeight(child, style, columnWidth),
          0,
        ) + line
      );
    case "code": {
      const lines = node.value.split("\n").length;
      return lines * (style.fontSize - 1) * 1.4 + style.fontSize * 2 + line / 2;
    }
    case "thematicBreak":
      return line * 2;
    case "figure":
      return columnWidth * 0.75 + line * 3;
    case "tableDirective": {
      const bodyHeight = node.body
        ? node.body.reduce((sum, child) => sum + estimateBlockHeight(child, style, columnWidth), 0)
        : line * 4;
      return bodyHeight + line * 2;
    }
    case "table":
      return (1 + node.rows.length) * (style.fontSize + 8) + line;
    case "references": {
      let height = line * 2;
      for (const entry of style.bibliography) {
        height += estimateTextHeight(formatBibEntry(entry), style, columnWidth) + line * 0.2;
      }
      return height;
    }
    case "pagebreak":
      return 0;
    case "tableOfContents": {
      const entries = style.toc.filter((h) => h.depth <= node.levels);
      let height = line * 2;
      for (const entry of entries) {
        height += estimateTextHeight(entry.text, style, columnWidth) + line * 0.2;
      }
      return height;
    }
    case "footnoteDefinition":
      return 0;
    default:
      return line;
  }
}

function estimateTextHeight(
  text: string,
  style: ResolvedStyle,
  columnWidth: number,
  fontSize = style.fontSize,
): number {
  const avgCharWidth = fontSize * 0.5;
  const charsPerLine = Math.max(10, Math.floor(columnWidth / avgCharWidth));
  const lines = Math.max(1, Math.ceil(Math.max(text.length, 1) / charsPerLine));
  return lines * fontSize * style.lineHeight * 1.15;
}

function renderFootnotes(
  footnoteDefs: Extract<BlockNode, { type: "footnoteDefinition" }>[],
  style: ResolvedStyle,
): ReactNode {
  if (footnoteDefs.length === 0) return null;
  return createElement(
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
              return c.children.map((inline, k) => renderInline(inline, `${j}-${k}`, style));
            }
            return [renderBlock(c, j, style)];
          }),
        ),
      ),
    ),
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
          id: node.id ?? headingSlug(inlineText(node.children)),
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
    case "tableOfContents": {
      const entries = style.toc.filter((h) => h.depth <= node.levels);
      return createElement(
        View,
        { key, id: node.id, style: { marginVertical: style.fontSize * style.lineHeight } },
        node.title
          ? createElement(
              Text,
              {
                style: {
                  fontFamily: resolveFontFamily(style.fontFamily, "bold"),
                  textAlign: "center",
                  marginBottom: style.fontSize * style.lineHeight,
                  lineHeight: style.lineHeight,
                },
              },
              node.title,
            )
          : null,
        ...entries.map((entry) =>
          createElement(
            Text,
            {
              key: entry.id,
              style: {
                textAlign: "left",
                paddingLeft: (entry.depth - 1) * style.fontSize,
                marginBottom: 0,
                lineHeight: style.lineHeight,
                textIndent: 0,
              },
            },
            createElement(Link, { src: `#${entry.id}` }, entry.text),
          ),
        ),
      );
    }
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
    ` [comment: ${node.text}]`,
  );
}

function defaultHeadingFormat(depth: 1 | 2 | 3 | 4 | 5 | 6): HeadingFormat {
  if (depth === 1) return { fontWeight: "bold", textAlign: "center" };
  if (depth === 2) return { fontWeight: "bold", textAlign: "left" };
  if (depth === 3) return { fontWeight: "bold", fontStyle: "italic", textAlign: "left" };
  return { fontWeight: "bold", textAlign: "left", indent: 0.5 };
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
