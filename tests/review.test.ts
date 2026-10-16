import { describe, expect, it } from "vite-plus/test";

import { parse } from "../src/parse.ts";
import { applyReview, replyToReview, setComment, listReviewMarkers } from "../src/review.ts";

describe("listReviewMarkers", () => {
  it("lists additions, deletions, substitutions, comments", () => {
    const source =
      "Add :insert[one] and remove :delete[two]. Replace :delete[a]:insert[b]. :comment[note]";
    const markers = listReviewMarkers(source);
    expect(markers.map((m) => m.kind)).toEqual(["addition", "deletion", "substitution", "comment"]);
  });

  it("reports marker content and offsets", () => {
    const source = "A :insert[new] B";
    const markers = listReviewMarkers(source);
    expect(markers[0]).toMatchObject({
      kind: "addition",
      text: "new",
      start: 2,
      end: 14,
      contentStart: 10,
      contentEnd: 13,
    });
  });

  it("ignores markers inside code", () => {
    const source = "`:insert[x]` and\n```\n:delete[y]\n```\n:insert[real]";
    const markers = listReviewMarkers(source);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ kind: "addition", text: "real" });
  });
});

describe("source-aware review markers", () => {
  it.each([
    "\\:insert[literal] :delete[real]",
    '---\ntitle: ":insert[title]"\n---\n\n:delete[real]',
    '---\r\ntitle: ":insert[title]"\r\n---\r\n\r\n:delete[real]',
    "  ```\n  :insert[literal]\n  ```\n\n:delete[real]",
    "> ```\n> :insert[literal]\n> ```\n\n:delete[real]",
    "[link](https://example.com/:insert[literal]) :delete[real]",
  ])("only lists parsed markers in %s", (source) => {
    expect(listReviewMarkers(source)).toEqual([
      expect.objectContaining({
        kind: "deletion",
        text: "real",
        id: String(source.indexOf(":delete[real]")),
        start: source.indexOf(":delete[real]"),
        end: source.indexOf(":delete[real]") + 13,
      }),
    ]);
  });

  it.each([
    "# :insert[same] :insert[same] {#heading}",
    "> :insert[same]\n> :insert[same]",
    "- :insert[same]\n- :insert[same]",
    "[^a]: :insert[same]\n    :insert[same]",
    "| :insert[same] | :insert[same] |\n| --- | --- |",
    "::figure[:insert[same] :insert[same]](src=image.png)",
    "**:insert[same]** [label :insert[same]](url)",
    "😀 :insert[same]  \r\n:insert[same]",
  ])("preserves offsets through block and inline transformations in %s", (source) => {
    const markers = listReviewMarkers(source);
    const starts = [...source.matchAll(/:insert\[same\]/g)].map((match) => match.index);
    expect(markers.map((marker) => marker.start)).toEqual(starts);
    for (const marker of markers) {
      expect(source.slice(marker.start, marker.end)).toBe(":insert[same]");
      expect(source.slice(marker.contentStart, marker.contentEnd)).toBe(marker.text);
    }
  });

  it("lists nested markers with distinct source identities", () => {
    const source = ":comment[outer :comment[note]] :insert[real]";
    expect(listReviewMarkers(source).map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: "0", kind: "comment" },
      { id: "15", kind: "comment" },
      { id: "31", kind: "addition" },
    ]);
  });

  it("preserves raw multiline substitution text", () => {
    const source = "> :delete[old\r\n> value]:insert[new\r\n> value]";
    const [marker] = listReviewMarkers(source);
    expect(marker.oldText).toBe("old\r\n> value");
    expect(marker.newText).toBe("new\r\n> value");
    expect(source.slice(marker.start, marker.end)).toBe(source.slice(2));
  });
});

describe("directive threads", () => {
  it.each([
    ":delete[old]:insert[new]",
    ":insert[new]:delete[old]",
    ":delete[old]{#c4}:insert[new]{#c4}",
    ":insert[new]:delete[old]{#c4}",
    ":insert[new]{#c4}:delete[old]",
    ":delete[old]:insert[new]{#c4}",
  ])("groups replacement %s", (source) => {
    const document = parse(source);
    expect(document.body).toEqual([
      {
        type: "paragraph",
        children: [
          {
            type: "substitution",
            review: expect.objectContaining({
              kind: "substitution",
              oldText: "old",
              newText: "new",
              start: 0,
              end: source.length,
              ...(source.includes("#c4") ? { id: "c4", commentId: "c4" } : {}),
            }),
            old: [{ type: "text", value: "old" }],
            new: [{ type: "text", value: "new" }],
          },
        ],
      },
    ]);
    const [marker] = listReviewMarkers(document);
    expect(applyReview(source, marker, "accept")).toBe("new");
    expect(applyReview(source, marker, "reject")).toBe("old");
  });

  it("keeps separated directives and conflicting IDs separate", () => {
    expect(listReviewMarkers(":delete[a] :insert[b]")).toHaveLength(2);
    expect(listReviewMarkers(":delete[a]{#c1}:insert[b]{#c2}")).toHaveLength(2);
  });

  it("returns body AST and frontmatter comments, including nested replies", () => {
    const source = `---
title: Paper
comments:
  c1:
    by: author
    at: "2026-04-28T12:00:00.000Z"
    body: Check wording
  c10:
    re: c1
    body: this is a reply
    by: author
    at: "2026-04-28T12:00:00.000Z"
  c11:
    re: c10
    body: Nested reply
---
:comment[original **text**]{#c1}`;
    const document = parse(source);
    expect(document.comments).toEqual({
      c1: { by: "author", at: "2026-04-28T12:00:00.000Z", body: "Check wording" },
      c10: { re: "c1", body: "this is a reply", by: "author", at: "2026-04-28T12:00:00.000Z" },
      c11: { re: "c10", body: "Nested reply" },
    });
    expect(document.meta?.comments).toEqual(document.comments);
    expect(document.body).toMatchObject([
      {
        type: "paragraph",
        children: [
          {
            type: "comment",
            review: { id: "c1" },
            children: [
              { type: "text", value: "original " },
              { type: "strong", children: [{ type: "text", value: "text" }] },
            ],
          },
        ],
      },
    ]);
    const deleted = applyReview(source, listReviewMarkers(document)[0], "delete");
    expect(parse(deleted).comments).toEqual({});
    expect(deleted).toContain("original **text**");
    expect(parse(deleted).meta?.title).toBe("Paper");
  });

  it("replies to anonymous replacements with a persistent thread ID", () => {
    const source = ":insert[new]:delete[old]";
    const next = replyToReview(source, listReviewMarkers(source)[0], "c10", {
      body: "Reply",
      by: "Ada",
    });
    const document = parse(next);
    expect(listReviewMarkers(document)).toHaveLength(1);
    expect(document.comments.c10).toEqual({ re: "c-0", body: "Reply", by: "Ada" });
    expect(document.comments["c-0"]).toEqual({});
    const accepted = applyReview(next, listReviewMarkers(document)[0], "accept");
    expect(parse(accepted).comments).toEqual({});
    expect(accepted).toContain("new");
    expect(accepted).not.toContain(":insert");
  });

  it("edits metadata without changing other frontmatter or body", () => {
    const source =
      "---\ntitle: Paper\ncomments:\n  c1:\n    body: old\nkeywords:\n  - science\n---\n:comment[text]{#c1}";
    const next = setComment(source, "c1", { body: 'Quote " and newline\nnext', by: "Ada" });
    expect(parse(next).comments.c1.body).toBe('Quote " and newline\nnext');
    expect(parse(next).meta?.keywords).toEqual(["science"]);
    expect(next.endsWith(":comment[text]{#c1}")).toBe(true);
  });

  it("supports escaped brackets, nested directives, links, code and empty insertions", () => {
    const document = parse(
      ":comment[Read [link](url) and :insert[`]`]{#c2} or \\] escaped]{#c1} :insert[]{#c3}",
    );
    expect(listReviewMarkers(document).map((m) => m.id)).toEqual(["c1", "c2", "c3"]);
    expect(listReviewMarkers(document).at(-1)?.text).toBe("");
  });

  it("preserves directive IDs at the end of headings", () => {
    expect(listReviewMarkers("# :comment[Title]{#c1}")[0].id).toBe("c1");
  });

  it("does not recognize removed review syntax", () => {
    expect(listReviewMarkers("{++new++} {--old--} {~~old~>new~~} {==text==} {>>note<<}")).toEqual(
      [],
    );
  });
});

it("avoids existing IDs when adding a thread to an anonymous span", () => {
  const source = ":comment[anonymous] :comment[existing]{#c-0}";
  const next = replyToReview(source, listReviewMarkers(source)[0], "reply", { body: "New reply" });
  expect(listReviewMarkers(next).map((marker) => marker.commentId)).toEqual(["c-0-1", "c-0"]);
  expect(parse(next).comments.reply.re).toBe("c-0-1");
});

it("parses annotated figure/table captions and link labels as their enclosing nodes", () => {
  const document = parse(
    "::figure[:comment[Caption]{#c1}](src=image.png)\n\n::table[:insert[Title]{#c2}](src=table.md)\n\n[Read :comment[label]{#c3}](https://example.com)",
  );
  expect(document.body.map((node) => node.type)).toEqual(["figure", "tableDirective", "paragraph"]);
  expect(document.body[2]).toMatchObject({
    children: [
      {
        type: "link",
        children: [
          { type: "text", value: "Read " },
          { type: "comment", review: { id: "c3" } },
        ],
      },
    ],
  });
  expect(listReviewMarkers(document).map((marker) => marker.id)).toEqual(["c1", "c2", "c3"]);
});
