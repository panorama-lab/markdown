import type { BibEntry, CitationStyleName } from "./ast.ts";

export type TextRun = {
  text: string;
  italic?: boolean;
};

export type CitationSegment = {
  text: string;
  key?: string;
};

export type CitationStyle = {
  inText: (keys: string[], lookup: (key: string) => BibEntry | undefined) => CitationSegment[];
  reference: (entry: BibEntry) => TextRun[];
};

function splitAuthors(field: string): string[] {
  return field
    .split(/\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

function familyName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.includes(",")) return trimmed.split(",")[0]!.trim();
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] ?? trimmed;
}

function initials(given: string): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]!.toUpperCase()}.`)
    .join(" ");
}

function formatReferenceAuthor(name: string): string {
  const trimmed = name.trim();
  if (trimmed.includes(",")) {
    const [family, given] = trimmed.split(",");
    const formatted = initials((given ?? "").trim());
    return formatted ? `${family!.trim()}, ${formatted}` : family!.trim();
  }
  const parts = trimmed.split(/\s+/);
  const family = parts.pop() ?? trimmed;
  const formatted = initials(parts.join(" "));
  return formatted ? `${family}, ${formatted}` : family;
}

function joinReferenceAuthors(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

function yearOf(value: string | undefined): string {
  const match = value?.match(/\d{4}/);
  return match?.[0] ?? "n.d.";
}

function stripTrailingPeriod(value: string): string {
  return value.replace(/\.\s*$/, "");
}

export function formatInTextCitation(
  keys: string[],
  lookup: (key: string) => BibEntry | undefined,
): CitationSegment[] {
  const entries = keys.map((key) => ({ key, entry: lookup(key) }));
  const numbers = entries.map(({ key, entry }) =>
    unstructuredReference(entry) ? /^ref-(\d+)$/.exec(key)?.[1] : undefined,
  );
  if (numbers.length > 0 && numbers.every((number) => number !== undefined)) {
    return [
      { text: "[" },
      ...keys.flatMap((key, index) => [
        ...(index > 0 ? [{ text: ", " }] : []),
        { text: numbers[index]!, key },
      ]),
      { text: "]" },
    ];
  }
  const segments: CitationSegment[] = [{ text: "(" }];
  entries.forEach(({ key, entry }, index) => {
    if (index > 0) segments.push({ text: "; " });
    segments.push({ text: inTextLabel(entry, key), key });
  });
  segments.push({ text: ")" });
  return segments;
}

function inTextLabel(entry: BibEntry | undefined, key: string): string {
  if (!entry) return key;
  const { author, year: date } = entry.fields;
  const note = unstructuredReference(entry);
  if (note) {
    const source = note.trim();
    const reference = /^(.+?)\s*\((\d{4}[a-z]?)(?:,[^)]*)?\)\./.exec(source);
    if (!reference) {
      const authorFirst = /^([^,.]+),\s*(?:\p{Lu}\.[\s-]*)+(?:(et al\.)\s+)?(\d{4}[a-z]?)\./u.exec(
        source,
      );
      if (!authorFirst) return key;
      const [, surname, others, year] = authorFirst;
      return `${surname}${others ? ` ${others}` : ""}, ${year}`;
    }
    const [, authors, year] = reference;
    const names = [...authors!.matchAll(/(?:^|,\s*)(?:&\s*)?([^,]+),\s*(?:\p{Lu}\.[\s-]*)+/gu)].map(
      (match) => match[1]!.trim(),
    );
    return names.length ? authorYearLabel(names, year!) : `${authors}, ${year}`;
  }
  return authorYearLabel(author ? splitAuthors(author).map(familyName) : [], yearOf(date));
}

function unstructuredReference(entry: BibEntry | undefined): string | undefined {
  const fields = entry?.fields;
  if (fields && !fields.author && !fields.title && !fields.year) return fields.note;
}

function authorYearLabel(names: string[], year: string): string {
  if (names.length === 0) return year;
  if (names.length === 1) return `${names[0]}, ${year}`;
  if (names.length === 2) return `${names[0]} & ${names[1]}, ${year}`;
  return `${names[0]} et al., ${year}`;
}

export function formatReference(entry: BibEntry): TextRun[] {
  const f = entry.fields;
  const note = unstructuredReference(entry);
  if (note) return [{ text: note, italic: false }];
  const runs: TextRun[] = [];
  const push = (text: string, italic = false) => {
    if (text) runs.push({ text, italic });
  };

  const authors = f.author
    ? joinReferenceAuthors(splitAuthors(f.author).map(formatReferenceAuthor))
    : "";
  if (authors) push(`${authors} `);
  push(`(${yearOf(f.year)}).`);
  if (f.title) push(` ${stripTrailingPeriod(f.title)}.`);

  const container = f.journal ?? f.booktitle;
  if (container) {
    push(" ");
    push(stripTrailingPeriod(container), true);
    if (f.volume) {
      push(", ");
      push(f.volume, true);
      if (f.number) push(`(${f.number})`);
    }
    if (f.pages) push(`, ${f.pages.replace(/--/g, "–")}`);
    push(".");
  } else if (f.publisher) {
    push(` ${stripTrailingPeriod(f.publisher)}.`);
  }

  const url = f.doi
    ? `https://doi.org/${f.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")}`
    : f.url;
  if (url) push(` ${url}`);

  if (runs.length === 0) push(entry.key);
  return runs;
}

export const apaCitationStyle: CitationStyle = {
  inText: formatInTextCitation,
  reference: formatReference,
};

export const citationStyles: Record<CitationStyleName, CitationStyle> = {
  apa: apaCitationStyle,
};

export function resolveCitationStyle(name?: CitationStyleName | string): CitationStyle {
  if (name && name in citationStyles) return citationStyles[name as CitationStyleName];
  return apaCitationStyle;
}
