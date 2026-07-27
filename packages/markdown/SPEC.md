# Panorama Markdown Specification

Panorama Markdown is a small dialect for authoring academic papers and representing parsed papers in Markdown.

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

Do not use nested folders such as `figures/` or `tables/`. Keep every asset next to `content.md`. Filenames should be readable, not generic names such as `figure-01` or `table-0`.

### Asset paths

The `src` values for figures and tables are filenames resolved from the paper root:

```md
::figure[System overview](src=system.png){#fig-system}
::table[Experimental results](src=results.html){#tab-results}
```

## Front matter

Metadata lives in the YAML front matter at the top of the file. Do not repeat the title, abstract, or keywords in the body.

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

Use ATX headings. The document order defines the hierarchy, so omit section numbers. Do not number headings &mdash; write `Introduction`, not `1. Introduction`. The renderer adds numbering when needed.

```md
# Introduction

## Related work

### Baseline models
```

## Paragraphs and emphasis

Write paragraphs as standard Markdown, separated by a single blank line. Use standard emphasis:

```md
**strong text**
_italic text_
```

## Lists

Use standard Markdown syntax for unordered and ordered lists:

```md
- first item
- second item

1. first step
2. second step
```

## Links

Use standard Markdown link syntax:

```md
[GitHub](https://github.com)
```

## Footnotes

Use standard Markdown syntax for both footnote references and definitions:

```md
This claim needs a note.[^1]

[^1]: Footnote content goes here.
```

## Citations

Inline citations use the `:cite` text directive. Citation keys must match BibTeX entry keys. Supply one key or several keys separated by commas.

```md
Prior work established the baseline :cite[wang2023].
Later studies refined the method :cite[wang2023, wang2024].
```

Place the bibliography where the references section should appear:

```md
::references
```

The references block is populated from `references.bib` using the keys cited in the body.

## Cross-references

Link to a labeled section, figure, or table with `:ref`. The bracket text is the display label, and the `{#id}` attribute identifies the target.

```md
See :ref[Introduction]{#introduction} for the problem setup.
As shown in :ref[Figure 1]{#fig-system}, the pipeline has three stages.
```

Add the matching id to the target heading, figure, or table so the renderer can resolve the link.

## Page breaks

Insert an explicit page break with this leaf directive:

```md
::pagebreak
```

Use this only when the layout requires a hard break, for example before appendices. Otherwise, prefer the natural section flow.

## Figures

Figures are leaf directives. The bracket text supplies the caption. Attributes such as `src` point to the image asset.

```md
::figure[System overview](src=system.png)
```

Assign stable ids to figures that will be cross-referenced:

```md
::figure[System overview](src=system.png){#fig-system}
```

## Tables

Tables follow the same pattern as figures. The bracket text supplies the caption, and `src` points to table content at the paper root, such as a Markdown or HTML fragment.

```md
::table[Experimental results](src=results.md)
```
