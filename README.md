# Panorama Markdown

Panorama Markdown is a small dialect for writing academic papers and for representing parsed papers in Markdown.

It keeps standard Markdown for everyday markup and adds directives for citations, references, figures, tables, cross-references, and page breaks. The same format works in both directions: author a paper in Markdown, or convert an existing paper into this structure.

## Features

- **Standard Markdown** for headings, paragraphs, lists, links, footnotes, and emphasis
- **YAML front matter** for title, authors, abstract, and keywords
- **Citations** via `:cite` and a `::references` block backed by BibTeX
- **Figures and tables** as leaf directives with package-relative assets
- **Cross-references** via `:ref` to labeled sections, figures, and tables
- **Page breaks** via `::pagebreak`
- **Parse → AST → render** pipeline for HTML, PDF, DOCX, and LaTeX

## Download

![](<>)

Download the editor in release

open source roadmap
we will release the parser, ast, renderer when it's getting a bit stable, currently we integerate a APA style PDF renderer in the editor app.
follow the issue for feedback and progress https://github.com/panorama-lab/markdown/issues

Download the latest application build from the GitHub releases page:

https://github.com/panorama-lab/markdown/releases

## Specification

The full document format, package layout, parser pipeline, AST shape, and renderer behavior are defined in **[SPEC.md](SPEC.md)**.

## Community

- Report bugs or request features: https://github.com/panorama-lab/markdown/issues
- Join the Discord server: https://discord.gg/PtgNPuHMFs

## License

See [LICENSE](LICENSE).
