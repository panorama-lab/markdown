import type { BlockNode, InlineNode } from "../ast.ts";

export type TocEntry = {
  id: string;
  depth: number;
  text: string;
};

export function collectHeadings(body: BlockNode[]): TocEntry[] {
  const entries: TocEntry[] = [];
  const used = new Set<string>();
  const walk = (blocks: BlockNode[]) => {
    for (const b of blocks) {
      if (b.type === "heading") {
        const text = inlineText(b.children);
        const base = b.id ?? headingSlug(text);
        let id = base;
        let n = 2;
        while (used.has(id)) {
          id = `${base}-${n}`;
          n += 1;
        }
        used.add(id);
        entries.push({ id, depth: b.depth, text });
      }
      if (b.type === "list") {
        for (const item of b.children) walk(item.children);
      }
      if (b.type === "blockquote") walk(b.children);
      if (b.type === "tableDirective" && b.body) walk(b.body);
    }
  };
  walk(body);
  return entries;
}

export function headingSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

export function inlineText(nodes: InlineNode[]): string {
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
