import type { Author, FrontMatter } from "./ast.ts";

export function parseFrontMatter(source: string): {
  meta: FrontMatter | null;
  body: string;
  error?: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) {
    return { meta: null, body: source };
  }

  const body = source.slice(match[0].length);
  try {
    const data = parseYamlObject(match[1]);
    return { meta: toFrontMatter(data), body };
  } catch (err) {
    return {
      meta: null,
      body,
      error: err instanceof Error ? err.message : "Failed to parse YAML front matter",
    };
  }
}

function toFrontMatter(data: Record<string, unknown>): FrontMatter {
  const meta: FrontMatter = {};
  if (typeof data.title === "string") meta.title = data.title;
  if (typeof data.abstract === "string") meta.abstract = data.abstract;
  if (Array.isArray(data.keywords)) {
    meta.keywords = data.keywords.filter((k): k is string => typeof k === "string");
  }
  if (Array.isArray(data.authors)) {
    meta.authors = data.authors
      .filter(
        (a): a is Record<string, unknown> => !!a && typeof a === "object" && !Array.isArray(a),
      )
      .map((a): Author => {
        const author: Author = {
          name: typeof a.name === "string" ? a.name : "",
        };
        if (typeof a.email === "string") author.email = a.email;
        if (typeof a.affiliation === "string") author.affiliation = a.affiliation;
        if (typeof a.country === "string") author.country = a.country;
        if (typeof a.corresponding === "boolean") author.corresponding = a.corresponding;
        return author;
      });
  }
  return meta;
}

function parseYamlObject(source: string): Record<string, unknown> {
  const lines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const root: Record<string, unknown> = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      i += 1;
      continue;
    }

    const indent = leadingSpaces(line);
    if (indent !== 0) {
      throw new Error(`Unexpected indentation at line ${i + 1}`);
    }

    const keyMatch = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!keyMatch) {
      throw new Error(`Invalid front matter line: ${line}`);
    }

    const key = keyMatch[1];
    const rest = keyMatch[2];
    const result = parseValue(lines, i, 0, rest);
    root[key] = result.value;
    i = result.next;
  }

  return root;
}

function parseValue(
  lines: string[],
  index: number,
  baseIndent: number,
  rest: string,
): { value: unknown; next: number } {
  const trimmed = rest.trim();

  if (trimmed === "|" || trimmed === ">") {
    return parseBlockScalar(lines, index + 1, baseIndent, trimmed === "|");
  }

  if (trimmed === "") {
    return parseNested(lines, index + 1, baseIndent);
  }

  return { value: parseScalar(trimmed), next: index + 1 };
}

function parseNested(
  lines: string[],
  start: number,
  parentIndent: number,
): { value: unknown; next: number } {
  let i = start;
  while (i < lines.length && (!lines[i].trim() || lines[i].trimStart().startsWith("#"))) {
    i += 1;
  }
  if (i >= lines.length) {
    return { value: null, next: i };
  }

  const indent = leadingSpaces(lines[i]);
  if (indent <= parentIndent) {
    return { value: null, next: start };
  }

  if (/^\s*-\s+/.test(lines[i])) {
    return parseSequence(lines, start, parentIndent);
  }

  return parseMapping(lines, start, parentIndent);
}

function parseSequence(
  lines: string[],
  start: number,
  parentIndent: number,
): { value: unknown[]; next: number } {
  const items: unknown[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      i += 1;
      continue;
    }

    const indent = leadingSpaces(line);
    if (indent <= parentIndent) break;
    if (!/^\s*-\s+/.test(line) && indent === parentIndent) break;
    if (indent < parentIndent + 1) break;

    const itemMatch = /^(\s*)-\s+(.*)$/.exec(line);
    if (!itemMatch || leadingSpaces(line) <= parentIndent) break;

    const itemIndent = itemMatch[1].length;
    const rest = itemMatch[2];

    if (/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.test(rest)) {
      const keyMatch = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(rest)!;
      const obj: Record<string, unknown> = {};
      const first = parseValue(lines, i, itemIndent, keyMatch[2]);
      obj[keyMatch[1]] = first.value;
      i = first.next;

      while (i < lines.length) {
        const nextLine = lines[i];
        if (!nextLine.trim() || nextLine.trimStart().startsWith("#")) {
          i += 1;
          continue;
        }
        const nextIndent = leadingSpaces(nextLine);
        if (nextIndent <= itemIndent) break;
        if (/^\s*-\s+/.test(nextLine) && nextIndent === itemIndent) break;

        const fieldMatch = /^(\s*)([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(nextLine);
        if (!fieldMatch || fieldMatch[1].length <= itemIndent) break;

        const field = parseValue(lines, i, fieldMatch[1].length, fieldMatch[3]);
        obj[fieldMatch[2]] = field.value;
        i = field.next;
      }

      items.push(obj);
      continue;
    }

    const result = parseValue(lines, i, itemIndent, rest);
    items.push(result.value);
    i = result.next;
  }

  return { value: items, next: i };
}

function parseMapping(
  lines: string[],
  start: number,
  parentIndent: number,
): { value: Record<string, unknown>; next: number } {
  const obj: Record<string, unknown> = {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      i += 1;
      continue;
    }

    const indent = leadingSpaces(line);
    if (indent <= parentIndent) break;

    const keyMatch = /^(\s*)([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!keyMatch || keyMatch[1].length <= parentIndent) break;

    const result = parseValue(lines, i, keyMatch[1].length, keyMatch[3]);
    obj[keyMatch[2]] = result.value;
    i = result.next;
  }

  return { value: obj, next: i };
}

function parseBlockScalar(
  lines: string[],
  start: number,
  parentIndent: number,
  literal: boolean,
): { value: string; next: number } {
  const content: string[] = [];
  let i = start;
  let contentIndent: number | null = null;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      content.push("");
      i += 1;
      continue;
    }

    const indent = leadingSpaces(line);
    if (indent <= parentIndent) break;

    if (contentIndent === null) contentIndent = indent;
    content.push(line.slice(contentIndent));
    i += 1;
  }

  while (content.length > 0 && content[content.length - 1] === "") {
    content.pop();
  }

  if (literal) {
    return { value: content.join("\n") + (content.length ? "\n" : ""), next: i };
  }

  return { value: content.join(" ").replace(/\s+/g, " ").trim(), next: i };
}

function parseScalar(raw: string): string | boolean | number | null {
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;

  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);

  const commentIndex = raw.indexOf(" #");
  if (commentIndex !== -1) {
    return parseScalar(raw.slice(0, commentIndex).trimEnd());
  }

  return raw;
}

function leadingSpaces(line: string): number {
  const match = /^( *)/.exec(line);
  return match ? match[1].length : 0;
}
