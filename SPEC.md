# Panorama Markdown Specification

Panorama Markdown is a small dialect for writing academic papers and for representing parsed papers in Markdown.

It keeps standard Markdown for everyday markup and adds a few directives for citations, references, figures, tables, cross-references, and page breaks. The same format works in both directions: author a paper in Markdown, or convert an existing paper into this structure.

Prefer standard Markdown when it is enough.

## Directory structure

A paper is a **flat** directory. All files live at the paper root — no subdirectories. Paths in `content.md` are relative to that root.

```
paper-id/
  content.md          # required — body + YAML front matter
  references.bib      # optional — BibTeX sources for :cite / ::references
  system.png          # optional — figure assets
  results.html        # optional — table content or other assets
  original.pdf        # optional — source PDF when the paper was converted
```

| Path                | Required | Notes                                                   |
| ------------------- | -------- | ------------------------------------------------------- |
| `content.md`        | yes      | Single Markdown entry point; front matter + body        |
| `references.bib`    | no       | BibTeX file; citation keys must match `:cite[...]` keys |
| `*.png`, `*.jpg`, … | no       | Image files at the paper root; reference by filename    |
| `*.html`, `*.md`, … | no       | Table content or other assets at the paper root         |
| `original.pdf`      | no       | Preserved source when converting from PDF               |

Do not use nested folders such as `figures/` or `tables/`. Keep every asset next to `content.md`.

### Asset paths

Figure and table `src` values are filenames resolved from the paper root:

```md
::figure[System overview](src=system.png){#fig-system}
::table[Experimental results](src=results.html){#tab-results}
```

## Front matter

Metadata lives in YAML front matter at the top of the file. Do not repeat the title, abstract, or keywords in the body.

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

Use ATX headings. Omit section numbers; the document order defines the hierarchy. Do not number headings &mdash; write `Introduction`, not `1. Introduction`. Numbering is added by the renderer when needed.

```md
# Introduction

## Related work

### Baseline models
```

## Paragraphs and emphasis

Write paragraphs as ordinary Markdown. Separate paragraphs with a single blank line. Use standard emphasis:

```md
**strong text**
_italic text_
```

## Lists

Unordered and ordered lists use standard Markdown:

```md
- first item
- second item

1. first step
2. second step
```

## Links

```md
[GitHub](https://github.com)
```

## Footnotes

Footnote references and definitions both use standard Markdown:

```md
This claim needs a note.[^1]

[^1]: Footnote content goes here.
```

## Citations

Inline citations use the `:cite` text directive. Citation keys match BibTeX entry keys. Pass one key, or several keys separated by commas.

```md
Prior work established the baseline :cite[wang2023].
Later studies refined the method :cite[wang2023, wang2024].
```

Render the bibliography where the references section should appear:

```md
::references
```

The references block is filled from `references.bib` using the keys cited in the body.

## Cross-references

Link to a labeled section, figure, or table with `:ref`. The bracket text is the display label; the `{#id}` attribute is the target id.

```md
See :ref[Introduction]{#introduction} for the problem setup.
As shown in :ref[Figure 1]{#fig-system}, the pipeline has three stages.
```

Define the matching id on the target (heading, figure, or table) so the renderer can resolve the link.

## Page breaks

Insert an explicit page break with a leaf directive:

```md
::pagebreak
```

Use this only when layout requires a hard break (for example before appendices). Prefer natural section flow otherwise.

## Figures

Figures are leaf directives. The bracket text is the caption. Attributes such as `src` point at the image asset.

```md
::figure[System overview](src=system.png)
```

Give figures stable ids when they will be cross-referenced:

```md
::figure[System overview](src=system.png){#fig-system}
```

## Tables

Tables follow the same pattern as figures. The bracket text is the caption; `src` points at table content at the paper root (for example a markdown or HTML fragment).

```md
::table[Experimental results](src=results.md)
```

## Parser

The parser takes a **paper directory**, not a bare Markdown string alone. Asset paths and BibTeX are resolved relative to that root.

### Pipeline

```
paper-dir/  →  load content.md + assets  →  Markdown + directives  →  AST (JSON)
```

1. **Resolve package** — require `content.md` at the flat paper root; load optional `references.bib`, `original.pdf`, and other co-located assets.
2. **Front matter** — parse YAML into a metadata object; remainder is the body.
3. **Markdown + directives** — parse standard Markdown and Panorama Markdown directives (`:cite`, `:ref`, `::figure`, `::table`, `::references`, `::pagebreak`).
4. **Link assets** — resolve figure/table `src` filenames against the paper root; record missing assets as warnings.
5. **Collect citations** — gather keys from `:cite`; join with `references.bib` for bibliography data.
6. **Emit AST** — a JSON tree ready for rendering or further tooling.

### Input

| Input             | Accepted                       |
| ----------------- | ------------------------------ |
| Directory path    | yes — primary form             |
| Single `.md` file | only if no relative assets/bib |

### AST shape (conceptual)

```json
{
  "meta": {
    "title": "Paper title",
    "authors": [],
    "abstract": "...",
    "keywords": []
  },
  "body": [],
  "bibliography": [],
  "assets": {
    "figures": [],
    "tables": []
  },
  "warnings": []
}
```

- `body` — block/inline nodes (headings, paragraphs, directives).
- `bibliography` — entries cited in the body, ordered for `::references`.
- `assets` — resolved figure/table paths and load status.
- `warnings` — missing files, unknown cite keys, unresolved `:ref` targets, etc.

The AST is the single intermediate representation shared by all renderers.

## Renderer

Renderers consume the **parser AST** (JSON). They do not re-parse Markdown independently.

```
paper-dir → parser → AST (JSON) → renderer → output
```

### Shared behavior

| Concern          | Behavior                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| Heading numbers  | Optional; added by the renderer when the target format needs them         |
| Citations        | Expand `:cite` using bibliography data; place full list at `::references` |
| Cross-references | Resolve `:ref` to section/figure/table numbers or labels                  |
| Figures / tables | Embed or link assets from the paper package                               |
| Page breaks      | Honor `::pagebreak` where the format supports hard breaks                 |

### HTML webpage

Interactive reading view for the browser.

- Semantic HTML from the AST (article, sections, figures, tables).
- Numbered headings, figures, and tables when desired.
- Citation tooltips or links; bibliography at `::references`.
- Assets served from the flat paper package (filenames next to `content.md`).

### PDF

Printable layout for archival and submission-style output.

- Paginated layout; map `::pagebreak` to real page breaks.
- Embed figures; render tables to a print-friendly form.
- Stable page references only when the layout engine exposes them.

### Word (DOCX)

Editable document for collaboration outside the Markdown toolchain.

- Map headings, paragraphs, lists, footnotes, and emphasis to native Word styles.
- Figures and tables as Word drawing/table objects where possible.
- Citations and bibliography as plain text or native fields, depending on implementation.

### LaTeX

Source suitable for compilation with a TeX engine (for example pdfLaTeX, XeLaTeX, or LuaLaTeX).

- Emit a `.tex` document from the AST: title, authors, abstract, keywords, sections, and body.
- Map headings to `\section` / `\subsection` / `\subsubsection` (or equivalent document-class commands).
- Expand `:cite` to `\cite{...}` and emit a bibliography from `references.bib` (or BibLaTeX) at `::references`.
- Resolve `:ref` to `\ref{...}` / `\label{...}` for sections, figures, and tables.
- Figures as `\includegraphics` (or equivalent); tables as native `tabular` / `table` environments when possible.
- Map `::pagebreak` to `\newpage` or `\clearpage`.
- Math and emphasis map to standard LaTeX commands; footnotes to `\footnote`.
