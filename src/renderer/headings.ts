import type { BlockNode, InlineNode } from "../ast.ts";

type LabelPart = Extract<InlineNode, { type: "text" | "inlineCode" | "inlineMath" }>;

export type TocEntry = {
  id: string;
  depth: number;
  text: string;
  label: LabelPart[];
};

export function collectHeadings(body: BlockNode[], anchors?: Map<BlockNode, string>): TocEntry[] {
  const entries: TocEntry[] = [];
  const used = new Set<string>();
  const walk = (blocks: BlockNode[]) => {
    for (const b of blocks) {
      if (b.type === "heading") {
        const label = [...inlineLabelParts(b.children)];
        const text = label.map((part) => part.value).join("");
        const base = b.id ?? headingSlug(text);
        let id = base;
        let n = 2;
        while (used.has(id)) {
          id = `${base}-${n}`;
          n += 1;
        }
        used.add(id);
        anchors?.set(b, id);
        entries.push({ id, depth: b.depth, text, label });
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
  return Array.from(inlineLabelParts(nodes), (part) => part.value).join("");
}

function* inlineLabelParts(nodes: InlineNode[]): Generator<LabelPart> {
  for (const node of nodes) {
    switch (node.type) {
      case "text":
      case "inlineMath":
      case "inlineCode":
        yield node;
        break;
      case "strong":
      case "emphasis":
      case "link":
      case "strikethrough":
      case "addition":
      case "deletion":
      case "comment":
        yield* inlineLabelParts(node.children);
        break;
      case "substitution":
        yield* inlineLabelParts(node.old);
        break;
    }
  }
}
