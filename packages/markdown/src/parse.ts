import type {
  BibEntry,
  BlockNode,
  CommentMeta,
  Document,
  FootnoteDefinitionNode,
  InlineNode,
  ListItemNode,
  ParseOptions,
  ReviewComment,
  ReviewThread,
  TableCellNode,
  TableRowNode,
  Warning,
} from "./ast.ts";

import { parseFrontMatter } from "./frontmatter.ts";

export type { ParseOptions } from "./ast.ts";

export function parse(source: string, options?: ParseOptions): Document {
  const files = options?.files ?? {};
  const warnings: Warning[] = [];
  const { meta, body: bodySource, error } = parseFrontMatter(source);
  if (error) {
    warnings.push({ code: "invalid-front-matter", message: error });
  }
  const body = parseBlocks(bodySource);
  const reviews = collectReviews(body);
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
    body,
    bibliography,
    reviews,
    warnings,
  };
}

function parseBlocks(source: string): BlockNode[] {
  const lines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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
      const idMatch = /^(.*?)\s*\{#([a-zA-Z0-9_-]+)\}\s*$/.exec(text);
      if (idMatch) {
        text = idMatch[1].trimEnd();
        id = idMatch[2];
      }
      blocks.push({
        type: "heading",
        depth,
        children: parseInlines(text),
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
      /^::(?:figure|image)\[([^\]]*)\](?:\(([^)]*)\))?(?:\{#([a-zA-Z0-9_-]+)\})?\s*$/.exec(
        line.trim(),
      );
    if (figureMatch) {
      const attrs = parseAttrs(figureMatch[2] ?? "");
      blocks.push({
        type: "figure",
        caption: parseInlines(figureMatch[1]),
        src: attrs.src ?? "",
        id: figureMatch[3],
      });
      i += 1;
      continue;
    }

    const tableDirMatch = /^::table\[([^\]]*)\](?:\(([^)]*)\))?(?:\{#([a-zA-Z0-9_-]+)\})?\s*$/.exec(
      line.trim(),
    );
    if (tableDirMatch) {
      const attrs = parseAttrs(tableDirMatch[2] ?? "");
      blocks.push({
        type: "tableDirective",
        caption: parseInlines(tableDirMatch[1]),
        src: attrs.src ?? "",
        id: tableDirMatch[3],
      });
      i += 1;
      continue;
    }

    if (/^::/.test(line.trim())) {
      blocks.push({
        type: "paragraph",
        children: parseInlines(line.trim()),
      });
      i += 1;
      continue;
    }

    const footnoteDefMatch = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line);
    if (footnoteDefMatch) {
      const id = footnoteDefMatch[1];
      const first = footnoteDefMatch[2];
      const contentLines = [first];
      i += 1;
      while (i < lines.length && (lines[i].startsWith("    ") || lines[i].startsWith("\t"))) {
        contentLines.push(lines[i].replace(/^(?:    |\t)/, ""));
        i += 1;
      }
      const children = parseBlocks(contentLines.join("\n"));
      const def: FootnoteDefinitionNode = {
        type: "footnoteDefinition",
        id,
        children:
          children.length > 0 ? children : [{ type: "paragraph", children: parseInlines(first) }],
      };
      blocks.push(def);
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && (/^ {0,3}>/.test(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim() === "" && quoteLines.length === 0) break;
        if (lines[i].trim() === "") {
          quoteLines.push("");
        } else {
          quoteLines.push(lines[i].replace(/^ {0,3}>\s?/, ""));
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
        children: parseBlocks(quoteLines.join("\n")),
      });
      continue;
    }

    if (isListLine(line)) {
      const { list, next } = parseList(lines, i);
      blocks.push(list);
      i = next;
      continue;
    }

    if (isTableLine(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const { table, next } = parseTable(lines, i);
      blocks.push(table);
      i = next;
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i += 1;
    }
    if (paraLines.length > 0) {
      const text = paraLines
        .join("\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n/g, " ");
      const hardBreakText = paraLines
        .map((l, idx) =>
          idx < paraLines.length - 1 && / {2}$/.test(l) ? l.replace(/ {2}$/, "\n") : l,
        )
        .join(" ")
        .replace(/ \n /g, "\n");
      blocks.push({
        type: "paragraph",
        children: parseInlines(hardBreakText.includes("\n") ? hardBreakText : text),
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

function parseList(lines: string[], start: number): { list: BlockNode; next: number } {
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
    const content = line.replace(/^ {0,3}(?:[-*+]|\d+\.)\s+/, "");
    const itemLines = [content];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isListLine(lines[i]) &&
      !isBlockStart(lines[i])
    ) {
      itemLines.push(lines[i].replace(/^ {2,4}/, ""));
      i += 1;
    }
    const children = parseBlocks(itemLines.join("\n"));
    items.push({
      type: "listItem",
      children:
        children.length > 0 ? children : [{ type: "paragraph", children: parseInlines(content) }],
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

function parseTable(lines: string[], start: number): { table: BlockNode; next: number } {
  const header = parseTableRow(lines[start]);
  let i = start + 2;
  const rows: TableRowNode[] = [];
  while (i < lines.length && isTableLine(lines[i]) && !isTableSeparator(lines[i])) {
    rows.push(parseTableRow(lines[i]));
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

function parseTableRow(line: string): TableRowNode {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  const cells = s.split("|").map((c) => c.trim());
  const children: TableCellNode[] = cells.map((c) => ({
    type: "tableCell",
    children: parseInlines(c),
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

    if (source.startsWith("{++", i)) {
      const end = source.indexOf("++}", i + 3);
      if (end !== -1) {
        nodes.push({ type: "addition", children: parseInlines(source.slice(i + 3, end)) });
        i = end + 3;
        continue;
      }
    }

    if (source.startsWith("{--", i)) {
      const end = source.indexOf("--}", i + 3);
      if (end !== -1) {
        nodes.push({ type: "deletion", children: parseInlines(source.slice(i + 3, end)) });
        i = end + 3;
        continue;
      }
    }

    if (source.startsWith("{~~", i)) {
      const end = source.indexOf("~~}", i + 3);
      if (end !== -1) {
        const inner = source.slice(i + 3, end);
        const sep = inner.indexOf("~>");
        if (sep !== -1) {
          nodes.push({
            type: "substitution",
            old: parseInlines(inner.slice(0, sep)),
            new: parseInlines(inner.slice(sep + 2)),
          });
          i = end + 3;
          continue;
        }
      }
    }

    if (source.startsWith("~~", i)) {
      const end = findClosing(source, i + 2, "~~");
      if (end !== -1) {
        nodes.push({
          type: "strikethrough",
          children: parseInlines(source.slice(i + 2, end)),
        });
        i = end + 2;
        continue;
      }
    }

    if (source.startsWith("{==", i)) {
      const end = source.indexOf("==}", i + 3);
      if (end !== -1) {
        nodes.push({ type: "highlight", children: parseInlines(source.slice(i + 3, end)) });
        i = end + 3;
        continue;
      }
    }

    if (source.startsWith("{>>", i)) {
      const end = source.indexOf("<<}", i + 3);
      if (end !== -1) {
        const text = source.slice(i + 3, end);
        let next = end + 3;
        let meta: CommentMeta | undefined;
        const metaMatch =
          /^\{((?:id|by|at|re)\s*=\s*"[^"]*"(?:\s+(?:id|by|at|re)\s*=\s*"[^"]*")*)\}/.exec(
            source.slice(next),
          );
        if (metaMatch) {
          meta = parseCommentMeta(metaMatch[1]);
          next += metaMatch[0].length;
        }
        nodes.push({ type: "comment", text, meta });
        i = next;
        continue;
      }
    }

    if (source.startsWith("**", i)) {
      const end = findClosing(source, i + 2, "**");
      if (end !== -1) {
        nodes.push({ type: "strong", children: parseInlines(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (source.startsWith("__", i)) {
      const end = findClosing(source, i + 2, "__");
      if (end !== -1) {
        nodes.push({ type: "strong", children: parseInlines(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (source[i] === "*" && source[i + 1] !== "*") {
      const end = findClosing(source, i + 1, "*");
      if (end !== -1) {
        nodes.push({ type: "emphasis", children: parseInlines(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (source[i] === "_" && source[i + 1] !== "_") {
      const end = findClosing(source, i + 1, "_");
      if (end !== -1) {
        nodes.push({ type: "emphasis", children: parseInlines(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (source[i] === "[") {
      const labelEnd = source.indexOf("]", i + 1);
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
            children: parseInlines(label),
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

function parseCommentMeta(raw: string): CommentMeta {
  const get = (key: string) => {
    const m = new RegExp(`${key}\\s*=\\s*"([^"]*)"`).exec(raw);
    return m?.[1] ?? "";
  };
  const meta: CommentMeta = {
    id: get("id"),
    by: get("by"),
    at: get("at"),
  };
  const re = get("re");
  if (re) meta.re = re;
  return meta;
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

function walkBlocks(blocks: BlockNode[], visit: (node: BlockNode | InlineNode) => void): void {
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
      case "highlight":
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

function collectReviews(body: BlockNode[]): ReviewThread[] {
  const comments: ReviewComment[] = [];
  walkBlocks(body, (node) => {
    if (node.type === "comment" && node.meta?.id) {
      comments.push({
        id: node.meta.id,
        by: node.meta.by,
        at: node.meta.at,
        re: node.meta.re,
        text: node.text,
      });
    }
  });

  const byId = new Map(comments.map((c) => [c.id, c]));
  const roots = comments.filter((c) => !c.re || !byId.has(c.re));
  const threads: ReviewThread[] = [];

  for (const root of roots) {
    const threadComments: ReviewComment[] = [root];
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of comments) {
        if (
          c.re &&
          threadComments.some((t) => t.id === c.re) &&
          !threadComments.some((t) => t.id === c.id)
        ) {
          threadComments.push(c);
          changed = true;
        }
      }
    }
    threads.push({ id: root.id, comments: threadComments });
  }

  return threads;
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
          node.body = parseBlocks(files[node.src]);
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
