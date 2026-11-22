# Panorama Markdown Syntax Specification 0.3.0

Panorama Markdown extends CommonMark with front matter, citations, figures, cross-references, and review directives.

## Front matter

Metadata lives in YAML front matter at the start of the document, delimited by `---` lines.

```yaml
---
title: Paper title
authors:
  - name: Author name
    email: author@example.com # optional
    affiliation: Affiliation # optional
    country: Country # optional
    corresponding: true # optional
abstract: |
  Paper abstract.
keywords:
  - keyword1
  - keyword2
---
```

| Field                     | Type             | Required | Notes                        |
| ------------------------- | ---------------- | -------- | ---------------------------- |
| `title`                   | string           | yes      | Document title               |
| `authors`                 | list of objects  | yes      | One entry per author         |
| `authors[].name`          | string           | yes      | Display name                 |
| `authors[].email`         | string           | no       | Contact email                |
| `authors[].affiliation`   | string           | no       | Institution or organization  |
| `authors[].country`       | string           | no       | Country                      |
| `authors[].corresponding` | boolean          | no       | Mark corresponding authors   |
| `abstract`                | string           | yes      | Abstract text                |
| `keywords`                | list of strings  | no       | Index terms                  |
| `comments`                | ID-keyed mapping | no       | Comment metadata and replies |

## Headings

Use ATX headings. The number of `#` characters defines the heading level.
Heading text must omit numeric section prefixes such as `1.` and `2.3`. When
importing a numbered document, use the source numbering to determine heading
levels and resolve section references where applicable. Preserve numbers that
are part of the title itself, such as `2024 results`.

```md
# Introduction

## Related work

### Baseline models
```

A heading may carry a stable id for cross-references:

```md
## Evaluation {#evaluation}
```

## Paragraphs and emphasis

Separate paragraphs with a blank line. Standard inline markup is supported:

```md
**strong text**
_italic text_ (or `*italic text*`)
`inline code`
~~strikethrough~~
```

End a line with two spaces to force a hard line break. Use a backslash to escape a literal character that would otherwise start markup, such as `\_` or `\*`.

## Formulas

Use `:math[TeX]` for inline formulas and a `:::math` container for display formulas. The optional attributes `#id` and `number` identify a display and print its source number in parentheses.

```md
Let :math[\bar{\phi}] be the mean threshold. See :ref[Equation 6]{#eq-6}.

:::math{#eq-6 number=6}
\beta > \frac{\gamma \cdot \bar{\phi}}{k - \bar{\phi} \cdot \langle k \rangle}
:::
```

Inline TeX occupies a single source line. Nested square brackets are allowed. To preserve an unmatched bracket, quote the payload with matching runs of backticks, as in `` :math[`\left[0,1\right)`] ``. Inline formulas work in table cells and captions, including TeX that contains a literal pipe. Dollar signs are ordinary text.

Display bodies preserve multiline TeX. Open with at least three colons and close with the same number or more. Without a closing fence, the display continues to the end of its enclosing block or document. Numbers are strings, so labels like `6a` and `A.1` are preserved. The AST stores raw TeX in `value` on `inlineMath` and `displayMath`, with optional `id` and `number` on display nodes.

React and PDF export use MathJax. Unsupported TeX remains readable as source. PDF export uses vector paths for supported displays and raster attachments for inline formulas. Call `renderAsync` from `@panorama-lab/markdown/pdf` to prepare inline formulas before export. The synchronous PDF `render` entry point renders inline TeX as source text.

PDF import recovers selected formulas from their glyph layout, including scripts, fractions, roots, summation limits, vectors, and multiline displays. When the importer recognizes a numbered equation, it assigns an `eq-` ID and links matching equation references with an unambiguous target. Equations with ambiguous layout can remain readable text.

## Lists

Use standard Markdown syntax for unordered and ordered lists:

```md
- first item
- second item

1. first step
2. second step
```

## Links

Use standard Markdown link syntax, optionally with a title:

```md
[GitHub](https://github.com)
[GitHub](https://github.com "Visit GitHub")
```

## Footnotes

Use standard Markdown syntax for both footnote references and definitions:

```md
This claim needs a note.[^1]

[^1]: Footnote content goes here.
```

## Citations

Inline citations use the `:cite` text directive. Citation keys must match BibTeX entry keys. Supply one key or several keys separated by commas:

```md
Prior work established the baseline :cite[wang2023].
Later studies refined the method :cite[wang2023, wang2024].
```

Place the bibliography where the references section should appear:

```md
::references
```

The references block includes entries from `references.bib` in order of first citation.

## Page breaks

Insert an explicit page break with this leaf directive:

```md
::pagebreak
```

## Directive attributes

Generic directives use square brackets for labels and braces for attributes. Place them immediately after the directive name and each other. Use `{#id}` or `{id=value}` to set an ID. Separate attributes with spaces and quote values containing spaces.

## Figures

Figures are leaf directives. The bracket text supplies the caption, and the `src` attribute points to the image asset:

```md
::figure[System overview]{src=system.png}
```

`::image` is accepted as an alias for `::figure`. Assign stable ids to figures that will be cross-referenced:

```md
::figure[System overview]{#fig-system src=system.png}
```

which is short for

```md
::figure[System overview]{id=fig-system src=system.png}
```

## Tables

Tables follow the same pattern as figures. The bracket text supplies the caption, and `src` points to table content &mdash; typically a Markdown or HTML fragment:

```md
::table[Experimental results]{#tab-results src=results.md}
```

The referenced content is parsed as Markdown, so pipe tables, headings, and paragraphs all work inside it. Inline pipe tables in the body are also supported:

```md
| Model | Accuracy |
| ----- | -------- |
| A     | 0.91     |
| B     | 0.87     |
```

## Cross-references

Link to a labeled section, figure, table, or equation with `:ref`. The bracket text supplies the display label. If the label is omitted, the ID is displayed.

```md
See :ref[Introduction]{#introduction} for the problem setup.
As shown in :ref[Figure 1]{#fig-system}, the pipeline has three stages.
See :ref[Equation 6]{#eq-6} for the threshold.
```

The target must carry the matching ID.

## Table of contents

Insert a table of contents with the `::table_of_contents` directive. The bracket text is the block's title, and `levels` controls how many heading levels are listed (default 3, maximum 6):

```md
::table_of_contents[Table of contents]{levels=3}
```

The table of contents includes body headings whose level is less than or equal to `levels`.

## Comments and suggested edits

Inline review directives annotate document text. Their contents support inline Markdown, nested directives, escaped brackets, and inline code. Directives are ignored in code, escaped text, front matter, and link destinations.

| Directive                      | Meaning                           |
| ------------------------------ | --------------------------------- |
| `:comment[original text]{#c1}` | Anchor a comment to original text |
| `:delete[original text]{#c2}`  | Suggest deleting original text    |
| `:insert[new text]{#c3}`       | Suggest inserting new text        |

`{#id}` is optional. IDs contain letters, digits, underscores, or hyphens. An explicit ID associates a directive with metadata under the same key in front matter. Comment contents are original document text; the comment message belongs in metadata `body`.

### Metadata and replies

`comments` is an ID-keyed YAML mapping, rather than a sequence. Each entry accepts `by` (author), `at` (an ISO 8601 timestamp string), `body` (the comment message), and `re` (the parent comment ID). Metadata fields are optional; replies normally provide a body and parent ID. Use spaces for YAML indentation.

```md
---
comments:
  c1:
    by: author
    at: "2026-04-28T12:00:00.000Z"
    body: Please clarify this sentence.
  c10:
    re: c1
    body: this is a reply
    by: author
    at: "2026-04-28T12:00:00.000Z"
  c11:
    re: c10
    body: A nested reply.
---

:comment[original text]{#c1}
```

Replies can target comments, suggestions, or other replies using `re`. They need no inline directive of their own. Reply order follows frontmatter order. A thread can also have nested inline anchors, each with its own ID.

### Replacement suggestions

An immediately adjacent delete and insert form one replacement suggestion in either order:

```md
:delete[old text]:insert[new text]
:insert[new text]:delete[old text]
:delete[old text]{#c4}:insert[new text]{#c4}
:insert[new text]:delete[old text]{#c4}
:insert[new text]{#c4}:delete[old text]
```

A shared ID or an ID on either half identifies the whole replacement and its single comment thread. Two different explicit IDs keep the directives separate. Whitespace or text between the directives also keeps them separate.
