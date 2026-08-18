export type CriticKind = "addition" | "deletion" | "substitution" | "highlight" | "comment";

export type CriticMarker = {
  kind: CriticKind;
  text?: string;
  oldText?: string;
  newText?: string;
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
};

export function listCriticMarkers(source: string): CriticMarker[] {
  const markers: CriticMarker[] = [];
  let i = 0;

  while (i < source.length) {
    if (source.startsWith("```", i)) {
      const close = source.indexOf("\n```", i + 3);
      if (close === -1) break;
      i = close + 4;
      continue;
    }

    if (source[i] === "`") {
      const close = source.indexOf("`", i + 1);
      if (close === -1) {
        i += 1;
        continue;
      }
      i = close + 1;
      continue;
    }

    const addition = tryMatch(source, i, "{++", "++}", "addition");
    if (addition) {
      markers.push(addition);
      i = addition.end;
      continue;
    }

    const deletion = tryMatch(source, i, "{--", "--}", "deletion");
    if (deletion) {
      markers.push(deletion);
      i = deletion.end;
      continue;
    }

    if (source.startsWith("{~~", i)) {
      const end = source.indexOf("~~}", i + 3);
      if (end !== -1) {
        const inner = source.slice(i + 3, end);
        const sep = inner.indexOf("~>");
        if (sep !== -1) {
          markers.push({
            kind: "substitution",
            oldText: inner.slice(0, sep),
            newText: inner.slice(sep + 2),
            start: i,
            end: end + 3,
            contentStart: i + 3,
            contentEnd: end,
          });
          i = end + 3;
          continue;
        }
      }
    }

    const highlight = tryMatch(source, i, "{==", "==}", "highlight");
    if (highlight) {
      markers.push(highlight);
      i = highlight.end;
      continue;
    }

    const comment = tryMatch(source, i, "{>>", "<<}", "comment");
    if (comment) {
      markers.push(comment);
      i = comment.end;
      continue;
    }

    i += 1;
  }

  return markers;
}

function tryMatch(
  source: string,
  i: number,
  open: string,
  close: string,
  kind: CriticKind,
): CriticMarker | null {
  if (!source.startsWith(open, i)) return null;
  const end = source.indexOf(close, i + open.length);
  if (end === -1) return null;
  return {
    kind,
    text: source.slice(i + open.length, end),
    start: i,
    end: end + close.length,
    contentStart: i + open.length,
    contentEnd: end,
  };
}
