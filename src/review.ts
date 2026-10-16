import type { CommentMetadata, Document } from "./ast.ts";

import { parse, walkBlocks } from "./parse.ts";

export type ReviewKind = "addition" | "deletion" | "substitution" | "comment";

export type ReviewMarker = {
  id: string;
  commentId?: string;
  file?: string;
  kind: ReviewKind;
  text?: string;
  oldText?: string;
  newText?: string;
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
};

export function listReviewMarkers(source: string | Document): ReviewMarker[] {
  const document = typeof source === "string" ? parse(source) : source;
  const markers: ReviewMarker[] = [];
  walkBlocks(document.body, (node) => {
    if ("review" in node && node.review) markers.push(node.review);
  });
  return markers.sort((a, b) => (a.file ?? "").localeCompare(b.file ?? "") || a.start - b.start);
}

export type ReviewAction = "accept" | "reject" | "delete";

export function applyReview(source: string, marker: ReviewMarker, action: ReviewAction): string {
  if (marker.file !== undefined) return source;
  if (marker.kind === "comment" && action !== "delete") return source;
  if (marker.kind !== "comment" && action === "delete") return source;
  let replacement: string;
  switch (marker.kind) {
    case "substitution":
      replacement = (action === "accept" ? marker.newText : marker.oldText) ?? "";
      break;
    case "addition":
      replacement = action === "accept" ? (marker.text ?? "") : "";
      break;
    case "deletion":
      replacement = action === "reject" ? (marker.text ?? "") : "";
      break;
    case "comment":
      replacement = marker.text ?? "";
      break;
  }
  const next = source.slice(0, marker.start) + replacement + source.slice(marker.end);
  return marker.commentId ? deleteComment(next, marker.commentId) : next;
}

export function setComment(source: string, id: string, value: CommentMetadata): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid comment ID");
  const comments = { ...parse(source).comments, [id]: value };
  return writeComments(source, comments);
}

export function deleteComment(source: string, id: string): string {
  const comments = { ...parse(source).comments };
  const removed = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, entry] of Object.entries(comments)) {
      if (entry.re && removed.has(entry.re) && !removed.has(key)) {
        removed.add(key);
        changed = true;
      }
    }
  }
  for (const key of removed) delete comments[key];
  return writeComments(source, comments);
}

export function replyToReview(
  source: string,
  marker: ReviewMarker,
  id: string,
  reply: CommentMetadata,
): string {
  if (marker.file !== undefined) return source;
  const anchored = anchorReview(source, marker);
  let next = anchored.source;
  if (!parse(next).comments[anchored.id]) next = setComment(next, anchored.id, {});
  return setComment(next, id, { ...reply, re: anchored.id });
}

export function setReviewComment(
  source: string,
  marker: ReviewMarker,
  value: CommentMetadata,
): string {
  if (marker.file !== undefined) return source;
  const anchored = anchorReview(source, marker);
  return setComment(anchored.source, anchored.id, value);
}

function anchorReview(source: string, marker: ReviewMarker): { source: string; id: string } {
  if (marker.commentId) return { source, id: marker.commentId };
  const document = parse(source);
  const used = new Set([
    ...Object.keys(document.comments),
    ...listReviewMarkers(document).map((item) => item.id),
  ]);
  let id = `c-${marker.start}`;
  while (used.has(id)) id += "-1";
  return { source: source.slice(0, marker.end) + `{#${id}}` + source.slice(marker.end), id };
}

function writeComments(source: string, comments: Record<string, CommentMetadata>): string {
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = Object.entries(comments).flatMap(([id, entry]) => [
    `  ${id}:`,
    ...Object.entries(entry).map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`),
  ]);
  const section = lines.length ? ["comments:", ...lines].join(newline) : "";
  if (!front) return section ? `---${newline}${section}${newline}---${newline}${source}` : source;
  const metadata = front[1];
  const metadataLines = metadata.split(/\r?\n/);
  const start = metadataLines.findIndex((line) => /^comments:/.test(line));
  if (start !== -1) {
    let end = start + 1;
    while (
      end < metadataLines.length &&
      (/^[ \t]/.test(metadataLines[end]) || !metadataLines[end].trim())
    )
      end += 1;
    metadataLines.splice(start, end - start, ...(section ? section.split(newline) : []));
  } else if (section) metadataLines.push(...section.split(newline));
  const next = metadataLines.join(newline);
  return `---${newline}${next}${newline}---${newline}` + source.slice(front[0].length);
}
