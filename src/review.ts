import type { Document } from "./ast.ts";

import { parse, walkBlocks } from "./parse.ts";

export type CriticKind = "addition" | "deletion" | "substitution" | "highlight" | "comment";

export type CriticMarker = {
  id: string;
  file?: string;
  kind: CriticKind;
  text?: string;
  oldText?: string;
  newText?: string;
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
};

export function listCriticMarkers(source: string | Document): CriticMarker[] {
  const document = typeof source === "string" ? parse(source) : source;
  const markers: CriticMarker[] = [];
  walkBlocks(document.body, (node) => {
    if ("review" in node && node.review) markers.push(node.review);
  });
  return markers.sort((a, b) => (a.file ?? "").localeCompare(b.file ?? "") || a.start - b.start);
}
