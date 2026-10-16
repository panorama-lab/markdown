import type {
  BibEntry,
  BlockNode,
  Document,
  FootnoteDefinitionNode,
  InlineNode,
  ListItemNode,
  ParseOptions,
  TableCellNode,
  TableRowNode,
  Warning,
} from "./ast.ts";
import type { ReviewKind, ReviewMarker } from "./review.ts";

import { parseFrontMatter } from "./frontmatter.ts";
import { SourceText } from "./source.ts";

export type { ParseOptions } from "./ast.ts";

export function parse(source: string, options?: ParseOptions): Document {
  const files = options?.files ?? {};
  const warnings: Warning[] = [];
  const { meta, body: afterFront, error } = parseFrontMatter(source);
  if (error) {
    warnings.push({ code: "invalid-front-matter", message: error });
  }
  const body = parseBlocks(new SourceText(source).slice(source.length - afterFront.length));
  const citeKeys = collectCiteKeys(body);
  const bibEntries = files["references.bib"] ? parseBibTeX(files["references.bib"]) : [];
  const bibByKey = new Map(bibEntries.map((e) => [e.key, e]));
  const bibliography: BibEntry[] = [];
  const seenCite = new Set<string>();
  for (const key of citeKeys) {
    if (seenCite.has(key)) continue;
    seenCite.add(key);
    const entry = bibByKey.get(key);
    if (entry) {
      bibliography.push(entry);
    } else if (files["references.bib"] !== undefined) {
      warnings.push({
        code: "unknown-cite-key",
        message: `Unknown citation key: ${key}`,
      });
    }
  }

  resolveAssets(body, files, warnings);
  validateRefs(body, warnings);

  return {
    meta,
    comments: meta?.comments ?? {},
    body,
    bibliography,
    warnings,
  };
}

function parseBlocks(source: SourceText): BlockNode[] {
  const mappedLines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines = mappedLines.map((line) => line.value);
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (/^ {0,3}```/.test(line)) {
      const langMatch = /^ {0,3}```([\w-]*)\s*$/.exec(line);
      const lang = langMatch?.[1] || undefined;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^ {0,3}```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", lang, value: codeLines.join("\n") });
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      const depth = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      let text = headingMatch[2];
      let id: string | undefined;
      const idMatch = /^(.*?)\s+\{#([a-zA-Z0-9_-]+)\}\s*$/.exec(text);
      if (idMatch) {
        text = idMatch[1].trimEnd();
        id = idMatch[2];
      }
      blocks.push({
        type: "heading",
        depth,
        children: parseMappedInlines(
          mappedLines[i].slice(
            line.indexOf(headingMatch[2]),
            line.indexOf(headingMatch[2]) + text.length,
          ),
        ),
        id,
      });
      i += 1;
      continue;
    }

    if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "thematicBreak" });
      i += 1;
      continue;
    }

    if (/^::pagebreak\s*$/.test(line.trim())) {
      blocks.push({ type: "pagebreak" });
      i += 1;
      continue;
    }

    if (/^::references\s*$/.test(line.trim())) {
      blocks.push({ type: "references" });
      i += 1;
      continue;
    }

    const figureMatch =
      /^::(?:figure|image)\[(.*)\](?:\(([^)]*)\))?(?:\{#([a-zA-Z0-9_-]+)\})?\s*$/.exec(line.trim());
    if (figureMatch) {
      const attrs = parseAttrs(figureMatch[2] ?? "");
      blocks.push({
        type: "figure",
        caption: parseMappedInlines(
          mappedLines[i].slice(
            line.indexOf("[") + 1,
            line.indexOf("[") + 1 + figureMatch[1].length,
          ),
        ),
        src: attrs.src ?? "",
        id: figureMatch[3],
      });
      i += 1;
      continue;
    }

    const tableDirMatch = /^::table\[(.*)\](?:\(([^)]*)\))?(?:\{#([a-zA-Z0-9_-]+)\})?\s*$/.exec(
      line.trim(),
    );
    if (tableDirMatch) {
      const attrs = parseAttrs(tableDirMatch[2] ?? "");
      blocks.push({
        type: "tableDirective",
        caption: parseMappedInlines(
          mappedLines[i].slice(
            line.indexOf("[") + 1,
            line.indexOf("[") + 1 + tableDirMatch[1].length,
          ),
        ),
        src: attrs.src ?? "",
        id: tableDirMatch[3],
      });
      i += 1;
      continue;
    }

    const tocMatch =
      /^::table_of_contents(?:\s*\[([^\]]*)\])?(?:\s*\(([^)]*)\))?(?:\s*\{([^}]*)\})?\s*$/.exec(
        line.trim(),
      );
    if (tocMatch) {
      const tail = tocMatch[3];
      const idMatch = /^#([a-zA-Z0-9_-]+)$/.exec(tail ?? "");
      const attrs = {
        ...parseAttrs(tocMatch[2] ?? ""),
        ...(tail && !idMatch ? parseAttrs(tail) : {}),
      };
      const levels = Number(attrs.levels ?? "3");
      blocks.push({
        type: "tableOfContents",
        title: tocMatch[1] ?? "",
        levels: Number.isFinite(levels) ? Math.min(6, Math.max(1, Math.floor(levels))) : 3,
        id: idMatch?.[1],
      });
      i += 1;
      continue;
    }

    if (/^::/.test(line.trim())) {
      blocks.push({
        type: "paragraph",
        children: parseMappedInlines(mappedLines[i].trim()),
      });
      i += 1;
      continue;
    }

    const footnoteDefMatch = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line);
    if (footnoteDefMatch) {
      const id = footnoteDefMatch[1];
      const first = footnoteDefMatch[2];
      const firstSource = mappedLines[i].slice(line.length - first.length);
      const contentLines = [firstSource];
      i += 1;
      while (i < lines.length && (lines[i].startsWith("    ") || lines[i].startsWith("\t"))) {
        contentLines.push(mappedLines[i].replace(/^(?:    |\t)/, ""));
        i += 1;
      }
      const children = parseBlocks(SourceText.join(contentLines, "\n"));
      const def: FootnoteDefinitionNode = {
        type: "footnoteDefinition",
        id,
        children:
          children.length > 0
            ? children
            : [{ type: "paragraph", children: parseMappedInlines(firstSource) }],
      };
      blocks.push(def);
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines: SourceText[] = [];
      while (i < lines.length && (/^ {0,3}>/.test(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim() === "" && quoteLines.length === 0) break;
        if (lines[i].trim() === "") {
          quoteLines.push(mappedLines[i].slice(0, 0));
        } else {
          quoteLines.push(mappedLines[i].replace(/^ {0,3}>\s?/, ""));
        }
        i += 1;
        if (
          i < lines.length &&
          lines[i].trim() === "" &&
          i + 1 < lines.length &&
          !/^ {0,3}>/.test(lines[i + 1])
        ) {
          break;
        }
      }
      blocks.push({
        type: "blockquote",
        children: parseBlocks(SourceText.join(quoteLines, "\n")),
      });
      continue;
    }

    if (isListLine(line)) {
      const { list, next } = parseList(mappedLines, i);
      blocks.push(list);
      i = next;
      continue;
    }

    if (isTableLine(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const { table, next } = parseTable(mappedLines, i);
      blocks.push(table);
      i = next;
      continue;
    }

    const paraLines: SourceText[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(mappedLines[i]);
      i += 1;
    }
    if (paraLines.length > 0) {
      const text = SourceText.join(paraLines, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n/g, " ");
      const hardBreakText = SourceText.join(
        paraLines.map((line, index) =>
          index < paraLines.length - 1 && / {2}$/.test(line.value)
            ? line.replace(/ {2}$/, "\n")
            : line,
        ),
        " ",
      ).replace(/ \n /g, "\n");
      blocks.push({
        type: "paragraph",
        children: parseMappedInlines(hardBreakText.value.includes("\n") ? hardBreakText : text),
      });
    }
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return (
    /^(#{1,6})\s+/.test(line) ||
    /^ {0,3}```/.test(line) ||
    /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    isDirectiveLine(line) ||
    /^\[\^[^\]]+\]:/.test(line) ||
    /^ {0,3}>/.test(line) ||
    isListLine(line) ||
    (isTableLine(line) && false)
  );
}

function isDirectiveLine(line: string): boolean {
  const t = line.trim();
  return (
    /^::pagebreak\s*$/.test(t) ||
    /^::references\s*$/.test(t) ||
    /^::table_of_contents(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?(?:\s*\{[^}]*\})?\s*$/.test(t) ||
    /^::(?:figure|image)\[[^\]]*\]/.test(t) ||
    /^::table\[[^\]]*\]/.test(t) ||
    /^::/.test(t)
  );
}

function isListLine(line: string): boolean {
  return /^ {0,3}([-*+]|\d+\.)\s+/.test(line);
}

function isTableLine(line: string): boolean {
  return /^\s*\|/.test(line) && line.includes("|");
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
}

function parseList(mappedLines: SourceText[], start: number): { list: BlockNode; next: number } {
  const lines = mappedLines.map((line) => line.value);
  const first = lines[start];
  const ordered = /^\s*\d+\./.test(first);
  const startNumMatch = /^\s*(\d+)\./.exec(first);
  const startNum = startNumMatch ? Number(startNumMatch[1]) : undefined;
  const items: ListItemNode[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      if (i + 1 < lines.length && isListLine(lines[i + 1])) {
        i += 1;
        continue;
      }
      break;
    }
    if (!isListLine(line)) break;
    const content = mappedLines[i].replace(/^ {0,3}(?:[-*+]|\d+\.)\s+/, "");
    const itemLines = [content];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isListLine(lines[i]) &&
      !isBlockStart(lines[i])
    ) {
      itemLines.push(mappedLines[i].replace(/^ {2,4}/, ""));
      i += 1;
    }
    const children = parseBlocks(SourceText.join(itemLines, "\n"));
    items.push({
      type: "listItem",
      children:
        children.length > 0
          ? children
          : [{ type: "paragraph", children: parseMappedInlines(content) }],
    });
  }

  return {
    list: {
      type: "list",
      ordered,
      start: ordered ? startNum : undefined,
      children: items,
    },
    next: i,
  };
}

function parseTable(mappedLines: SourceText[], start: number): { table: BlockNode; next: number } {
  const lines = mappedLines.map((line) => line.value);
  const header = parseTableRow(mappedLines[start]);
  let i = start + 2;
  const rows: TableRowNode[] = [];
  while (i < lines.length && isTableLine(lines[i]) && !isTableSeparator(lines[i])) {
    rows.push(parseTableRow(mappedLines[i]));
    i += 1;
  }
  return {
    table: {
      type: "table",
      header,
      rows,
    },
    next: i,
  };
}

function parseTableRow(line: SourceText): TableRowNode {
  let s = line.trim();
  if (s.value.startsWith("|")) s = s.slice(1);
  if (s.value.endsWith("|")) s = s.slice(0, -1);
  const cells = s.split("|").map((c) => c.trim());
  const children: TableCellNode[] = cells.map((c) => ({
    type: "tableCell",
    children: parseMappedInlines(c),
  }));
  return { type: "tableRow", children };
}

function parseAttrs(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw.trim()) return result;
  const re = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    result[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  if (!result.src && raw.includes("=") === false && raw.trim()) {
    result.src = raw.trim();
  }
  return result;
}

export function parseInlines(source: string): InlineNode[] {
  return parseMappedInlines(new SourceText(source));
}

type ReviewDirective = {
  kind: "addition" | "deletion" | "comment";
  id?: string;
  contentStart: number;
  contentEnd: number;
  end: number;
};

function readReviewDirective(source: string, start: number): ReviewDirective | undefined {
  const match = /^:(comment|insert|delete)\[/.exec(source.slice(start));
  if (!match) return;
  const contentStart = start + match[0].length;
  const contentEnd = findBracketEnd(source, contentStart);
  if (contentEnd === -1) return;
  const id = /^\{#([a-zA-Z0-9_-]+)\}/.exec(source.slice(contentEnd + 1));
  return {
    kind: match[1] === "insert" ? "addition" : match[1] === "delete" ? "deletion" : "comment",
    id: id?.[1],
    contentStart,
    contentEnd,
    end: contentEnd + 1 + (id?.[0].length ?? 0),
  };
}

function findBracketEnd(source: string, contentStart: number): number {
  let depth = 1;
  let cursor = contentStart;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === "`") {
      const end = source.indexOf("`", cursor + 1);
      if (end !== -1) {
        cursor = end + 1;
        continue;
      }
    }
    if (source[cursor] === "[") depth += 1;
    if (source[cursor] === "]") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }
  return -1;
}

function parseMappedInlines(input: SourceText): InlineNode[] {
  const source = input.value;
  const nodes: InlineNode[] = [];
  let i = 0;

  const pushText = (value: string) => {
    if (!value) return;
    const last = nodes[nodes.length - 1];
    if (last && last.type === "text") {
      last.value += value;
    } else {
      nodes.push({ type: "text", value });
    }
  };

  while (i < source.length) {
    if (source[i] === "\n") {
      nodes.push({ type: "break" });
      i += 1;
      continue;
    }

    if (source[i] === "\\" && i + 1 < source.length) {
      pushText(source[i + 1]);
      i += 2;
      continue;
    }

    if (source.startsWith("`", i)) {
      const end = source.indexOf("`", i + 1);
      if (end !== -1) {
        nodes.push({ type: "inlineCode", value: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (source.startsWith(":cite[", i)) {
      const end = source.indexOf("]", i + 6);
      if (end !== -1) {
        const keys = source
          .slice(i + 6, end)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        nodes.push({ type: "cite", keys });
        i = end + 1;
        continue;
      }
    }

    if (source[i] === "[") {
      const numericCite = /^\[(\d+(?:\s*,\s*\d+)*)\]/.exec(source.slice(i));
      if (numericCite && source[i + numericCite[0].length] !== "(") {
        nodes.push({
          type: "cite",
          keys: numericCite[1].split(",").map((key) => key.trim()),
        });
        i += numericCite[0].length;
        continue;
      }
    }

    if (source.startsWith(":ref[", i)) {
      const end = source.indexOf("]", i + 5);
      if (end !== -1) {
        const label = source.slice(i + 5, end);
        let id = "";
        let next = end + 1;
        const idMatch = /^\{#([a-zA-Z0-9_-]+)\}/.exec(source.slice(next));
        if (idMatch) {
          id = idMatch[1];
          next += idMatch[0].length;
        }
        nodes.push({ type: "ref", label, id });
        i = next;
        continue;
      }
    }

    if (source.startsWith("[^", i)) {
      const end = source.indexOf("]", i + 2);
      if (end !== -1 && !source.startsWith("]:", end)) {
        nodes.push({ type: "footnoteRef", id: source.slice(i + 2, end) });
        i = end + 1;
        continue;
      }
    }

    const directive = readReviewDirective(source, i);
    if (directive) {
      const following = readReviewDirective(source, directive.end);
      const paired =
        following &&
        directive.kind !== "comment" &&
        following.kind !== "comment" &&
        directive.kind !== following.kind &&
        (!directive.id || !following.id || directive.id === following.id)
          ? following
          : undefined;
      const end = paired?.end ?? directive.end;
      const commentId = directive.id ?? paired?.id;
      const startOffset = input.positions[i];
      const kind: ReviewKind = paired ? "substitution" : directive.kind;
      const raw = (part: ReviewDirective) =>
        input.original.slice(
          input.positions[part.contentStart],
          input.positions[part.contentEnd - 1] + 1,
        );
      const text = (part: ReviewDirective) =>
        part.contentStart === part.contentEnd ? "" : raw(part);
      const review: ReviewMarker = {
        id:
          input.file === undefined
            ? (commentId ?? String(startOffset))
            : `file:${encodeURIComponent(input.file)}:${commentId ?? startOffset}`,
        ...(commentId ? { commentId } : {}),
        ...(input.file === undefined ? {} : { file: input.file }),
        kind,
        start: startOffset,
        end: input.positions[end - 1] + 1,
        contentStart: input.positions[directive.contentStart],
        contentEnd: input.positions[directive.contentEnd],
      };
      if (paired) {
        const old = directive.kind === "deletion" ? directive : paired;
        const next = directive.kind === "addition" ? directive : paired;
        review.oldText = text(old);
        review.newText = text(next);
        nodes.push({
          type: "substitution",
          review,
          old: parseMappedInlines(input.slice(old.contentStart, old.contentEnd)),
          new: parseMappedInlines(input.slice(next.contentStart, next.contentEnd)),
        });
      } else {
        review.text = text(directive);
        nodes.push({
          type: directive.kind,
          review,
          children: parseMappedInlines(input.slice(directive.contentStart, directive.contentEnd)),
        });
      }
      i = end;
      continue;
    }

    if (source.startsWith("~~", i)) {
      const end = findClosing(source, i + 2, "~~");
      if (end !== -1) {
        nodes.push({
          type: "strikethrough",
          children: parseMappedInlines(input.slice(i + 2, end)),
        });
        i = end + 2;
        continue;
      }
    }

    if (source.startsWith("**", i)) {
      const end = findClosing(source, i + 2, "**");
      if (end !== -1) {
        nodes.push({ type: "strong", children: parseMappedInlines(input.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (source.startsWith("__", i)) {
      const end = findClosing(source, i + 2, "__");
      if (end !== -1) {
        nodes.push({ type: "strong", children: parseMappedInlines(input.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (source[i] === "*" && source[i + 1] !== "*") {
      const end = findClosing(source, i + 1, "*");
      if (end !== -1) {
        nodes.push({ type: "emphasis", children: parseMappedInlines(input.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (source[i] === "_" && source[i + 1] !== "_") {
      const end = findClosing(source, i + 1, "_");
      if (end !== -1) {
        nodes.push({ type: "emphasis", children: parseMappedInlines(input.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (source[i] === "[") {
      const labelEnd = findBracketEnd(source, i + 1);
      if (labelEnd !== -1 && source[labelEnd + 1] === "(") {
        const urlEnd = source.indexOf(")", labelEnd + 2);
        if (urlEnd !== -1) {
          const label = source.slice(i + 1, labelEnd);
          const urlPart = source.slice(labelEnd + 2, urlEnd);
          const titleMatch = /^(\S+)\s+"([^"]*)"$/.exec(urlPart);
          const url = titleMatch ? titleMatch[1] : urlPart;
          const title = titleMatch ? titleMatch[2] : undefined;
          nodes.push({
            type: "link",
            url,
            title,
            children: parseMappedInlines(input.slice(i + 1, labelEnd)),
          });
          i = urlEnd + 1;
          continue;
        }
      }
    }

    pushText(source[i]);
    i += 1;
  }

  return nodes;
}

function findClosing(source: string, from: number, marker: string): number {
  let i = from;
  while (i < source.length) {
    if (source.startsWith(marker, i)) return i;
    i += 1;
  }
  return -1;
}

function parseBibTeX(source: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const type = m[1].toLowerCase();
    const key = m[2];
    const body = m[3];
    const fields: Record<string, string> = {};
    const fieldRe = /(\w+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|(\S+))/g;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(body))) {
      fields[fm[1].toLowerCase()] = (fm[2] ?? fm[3] ?? fm[4] ?? "").trim();
    }
    entries.push({ key, type, fields });
  }
  return entries;
}

export function walkBlocks(
  blocks: BlockNode[],
  visit: (node: BlockNode | InlineNode) => void,
): void {
  for (const block of blocks) {
    visit(block);
    switch (block.type) {
      case "heading":
      case "paragraph":
        walkInlines(block.children, visit);
        break;
      case "list":
        for (const item of block.children) {
          visit(item);
          walkBlocks(item.children, visit);
        }
        break;
      case "blockquote":
      case "footnoteDefinition":
        walkBlocks(block.children, visit);
        break;
      case "figure":
        walkInlines(block.caption, visit);
        break;
      case "tableDirective":
        walkInlines(block.caption, visit);
        if (block.body) walkBlocks(block.body, visit);
        break;
      case "table":
        for (const cell of block.header.children) walkInlines(cell.children, visit);
        for (const row of block.rows) {
          for (const cell of row.children) walkInlines(cell.children, visit);
        }
        break;
      default:
        break;
    }
  }
}

function walkInlines(nodes: InlineNode[], visit: (node: BlockNode | InlineNode) => void): void {
  for (const node of nodes) {
    visit(node);
    switch (node.type) {
      case "strong":
      case "emphasis":
      case "link":
      case "strikethrough":
      case "addition":
      case "deletion":
      case "comment":
        walkInlines(node.children, visit);
        break;
      case "substitution":
        walkInlines(node.old, visit);
        walkInlines(node.new, visit);
        break;
      default:
        break;
    }
  }
}

function collectCiteKeys(body: BlockNode[]): string[] {
  const keys: string[] = [];
  walkBlocks(body, (node) => {
    if (node.type === "cite") keys.push(...node.keys);
  });
  return keys;
}

function resolveAssets(
  body: BlockNode[],
  files: Record<string, string>,
  warnings: Warning[],
): void {
  walkBlocks(body, (node) => {
    if (node.type === "figure") {
      if (node.src && files[node.src] === undefined) {
        warnings.push({
          code: "missing-asset",
          message: `Missing figure asset: ${node.src}`,
        });
      }
    }
    if (node.type === "tableDirective") {
      if (node.src) {
        if (files[node.src] === undefined) {
          warnings.push({
            code: "missing-asset",
            message: `Missing table asset: ${node.src}`,
          });
        } else {
          node.body = parseBlocks(new SourceText(files[node.src], undefined, undefined, node.src));
        }
      }
    }
  });
}

function validateRefs(body: BlockNode[], warnings: Warning[]): void {
  const ids = new Set<string>();
  walkBlocks(body, (node) => {
    if (node.type === "heading" && node.id) ids.add(node.id);
    if (node.type === "figure" && node.id) ids.add(node.id);
    if (node.type === "tableDirective" && node.id) ids.add(node.id);
  });
  walkBlocks(body, (node) => {
    if (node.type === "ref" && node.id && !ids.has(node.id)) {
      warnings.push({
        code: "unresolved-ref",
        message: `Unresolved reference: ${node.id}`,
      });
    }
  });
}
