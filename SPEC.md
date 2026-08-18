# Panorama Markdown Specification 0.3.0

Panorama Markdown is a small dialect for authoring academic papers and representing parsed papers in Markdown. It extends CommonMark with paper-oriented constructs &mdash; front matter, citations, figures, cross-references, and CriticMarkup review spans &mdash; while keeping the source readable and diff-friendly.

## Directory structure

A paper uses a **flat** directory: every file lives at the paper root, with no subdirectories. Paths in `content.md` are resolved relative to that root.

```
paper-directory/
  content.md          # required — body + YAML front matter
  references.bib      # optional — BibTeX sources for :cite / ::references
  system.png          # optional — figure assets
  results.md          # optional — markdown table content
  content.pdf         # optional — source PDF when the paper was converted
```

Do not use nested folders such as `figures/` or `tables/`. Keep every asset next to `content.md`, and give files readable names rather than generic ones such as `figure-01` or `table-0`.

### Asset paths

The `src` values of figures and tables are filenames resolved from the paper root:

```md
::figure[System overview](src=system.png){#fig-system}
::table[Experimental results](src=results.md){#tab-results}
```

## Front matter

Metadata lives in the YAML front matter at the top of `content.md`. Do not repeat the title, abstract, or keywords in the body.

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

| Field                     | Type            | Required | Notes                       |
| ------------------------- | --------------- | -------- | --------------------------- |
| `title`                   | string          | yes      | Document title              |
| `authors`                 | list of objects | yes      | One entry per author        |
| `authors[].name`          | string          | yes      | Display name                |
| `authors[].email`         | string          | no       | Contact email               |
| `authors[].affiliation`   | string          | no       | Institution or organization |
| `authors[].country`       | string          | no       | Country                     |
| `authors[].corresponding` | boolean         | no       | Mark corresponding authors  |
| `abstract`                | string          | yes      | Abstract text               |
| `keywords`                | list of strings | no       | Index terms                 |

## Headings

Use ATX headings. The document order defines the hierarchy, so do not number headings &mdash; write `Introduction`, not `1. Introduction`; the renderer adds numbering when needed.

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

Write paragraphs as standard Markdown, separated by a single blank line. Standard inline markup is supported:

```md
**strong text**
_italic text_ (or `*italic text*`)
`inline code`
~~strikethrough~~
```

End a line with two spaces to force a hard line break. Use a backslash to escape a literal character that would otherwise start markup, such as `\_` or `\*`.

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

The references block is populated from `references.bib` using the keys cited in the body, in order of first citation. Unknown keys are reported as parse warnings.

## Page breaks

Insert an explicit page break with this leaf directive:

```md
::pagebreak
```

Use this only when the layout requires a hard break, for example before appendices. Otherwise, prefer the natural section flow.

## Figures

Figures are leaf directives. The bracket text supplies the caption, and the `src` attribute points to the image asset:

```md
::figure[System overview](src=system.png)
```

`::image` is accepted as an alias for `::figure`. Assign stable ids to figures that will be cross-referenced:

```md
::figure[System overview](src=system.png){#fig-system}
```

which is short for

```md
::figure[System overview](src=system.png){id=fig-system}
```

## Tables

Tables follow the same pattern as figures. The bracket text supplies the caption, and `src` points to table content at the paper root &mdash; typically a Markdown or HTML fragment:

```md
::table[Experimental results](src=results.md){#tab-results}
```

The referenced content is parsed as Markdown, so pipe tables, headings, and paragraphs all work inside it. Inline pipe tables in the body are also supported:

```md
| Model | Accuracy |
| ----- | -------- |
| A     | 0.91     |
| B     | 0.87     |
```

## Cross-references

Link to a labeled section, figure, or table with `:ref`. The bracket text is the display label, and the `{#id}` attribute identifies the target:

```md
See :ref[Introduction]{#introduction} for the problem setup.
As shown in :ref{#fig-system}, the pipeline has three stages.
```

Add the matching id to the target heading, figure, or table so the renderer can resolve the link. References to ids that do not exist are reported as parse warnings.

## Table of contents

Insert a table of contents with the `::table_of_contents` directive. The bracket text is the block's title, and `levels` controls how many heading levels are listed (default 3, maximum 6):

```md
::table_of_contents[Table of contents]{levels=3}
```

The renderer lists every body heading at or above `levels`. Headings without an explicit `{#id}` get an automatically generated anchor id.

## CriticMarkup for comments and suggested edits

Panorama Markdown supports review spans based on CriticMarkup. Review markers are parsed as inline nodes and ignored inside inline code and fenced code blocks.

| Marker           | Meaning                | Example                 |
| ---------------- | ---------------------- | ----------------------- |
| `{++text++}`     | Suggested addition     | `Lorem {++ipsum++}`     |
| `{--text--}`     | Suggested deletion     | `Lorem {--ipsum--}`     |
| `{~~old~>new~~}` | Suggested substitution | `{~~hipsum~>ipsum~~}`   |
| `{==text==}`     | Highlight              | `{==this sentence==}`   |
| `{>>text<<}`     | Comment                | `{>>Needs a source.<<}` |

Renderers consume review nodes through `reviewMode` &mdash; `"markup"` (show markers), `"clean"` (apply additions, keep deletions), or `"accepted"` (apply all suggestions).
