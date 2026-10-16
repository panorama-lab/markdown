import { describe, expect, it } from "vite-plus/test";

import type { BibEntry } from "../src/ast.ts";

import { formatInTextCitation, formatReference, resolveCitationStyle } from "../src/citation.ts";

const entries: Record<string, BibEntry> = {
  smith2024: {
    key: "smith2024",
    type: "article",
    fields: {
      author: "Smith, John",
      title: "A Study of Things",
      journal: "Journal of Testing",
      volume: "12",
      number: "3",
      pages: "45--50",
      year: "2024",
    },
  },
  duo2023: {
    key: "duo2023",
    type: "inproceedings",
    fields: {
      author: "Smith, John and Jones, Mary",
      title: "Pairing Methods",
      booktitle: "Proceedings of Testing",
      year: "2023",
    },
  },
  trio2022: {
    key: "trio2022",
    type: "article",
    fields: {
      author: "Smith, John and Jones, Mary and Lee, Ann",
      title: "Three Ways",
      journal: "Journal of Testing",
      year: "2022",
    },
  },
};

const lookup = (key: string) => entries[key];

describe("formatInTextCitation", () => {
  it("formats a single author", () => {
    expect(formatInTextCitation(["smith2024"], lookup)).toEqual([
      { text: "(" },
      { text: "Smith, 2024", key: "smith2024" },
      { text: ")" },
    ]);
  });

  it("formats two authors with an ampersand", () => {
    const segments = formatInTextCitation(["duo2023"], lookup);
    expect(segments[1]).toEqual({ text: "Smith & Jones, 2023", key: "duo2023" });
  });

  it("formats three or more authors with et al.", () => {
    const segments = formatInTextCitation(["trio2022"], lookup);
    expect(segments[1]).toEqual({ text: "Smith et al., 2022", key: "trio2022" });
  });

  it("joins multiple keys in one citation", () => {
    const segments = formatInTextCitation(["smith2024", "duo2023"], lookup);
    expect(segments.map((segment) => segment.text).join("")).toBe(
      "(Smith, 2024; Smith & Jones, 2023)",
    );
  });

  it("falls back to the key when the entry is missing", () => {
    expect(formatInTextCitation(["missing"], lookup)).toEqual([
      { text: "(" },
      { text: "missing", key: "missing" },
      { text: ")" },
    ]);
  });
});

describe("formatReference", () => {
  it("formats a journal article in APA style", () => {
    const runs = formatReference(entries.smith2024!);
    expect(runs.map((run) => run.text).join("")).toBe(
      "Smith, J. (2024). A Study of Things. Journal of Testing, 12(3), 45–50.",
    );
    expect(runs.filter((run) => run.italic).map((run) => run.text)).toEqual([
      "Journal of Testing",
      "12",
    ]);
  });

  it("formats a conference paper in APA style", () => {
    expect(
      formatReference(entries.duo2023!)
        .map((run) => run.text)
        .join(""),
    ).toBe("Smith, J., & Jones, M. (2023). Pairing Methods. Proceedings of Testing.");
  });

  it("uses n.d. when no year is present", () => {
    const runs = formatReference({ key: "anon", type: "misc", fields: { title: "Untitled" } });
    expect(runs.map((run) => run.text).join("")).toBe("(n.d.). Untitled.");
  });
});

describe("resolveCitationStyle", () => {
  it("defaults to APA", () => {
    expect(resolveCitationStyle()).toBe(resolveCitationStyle("apa"));
  });

  it("falls back to APA for unknown names", () => {
    expect(resolveCitationStyle("unknown")).toBe(resolveCitationStyle("apa"));
  });
});
