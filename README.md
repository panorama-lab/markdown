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

Download the latest editor build from the [GitHub releases page](https://github.com/panorama-lab/markdown/releases).

## Roadmap

The parser, AST, and renderer will be open sourced once the API stabilizes. The editor currently integrates an APA-style PDF renderer. Follow [the issues](https://github.com/panorama-lab/markdown/issues) for updates and to share feedback.

## Specification

The full document format, package layout, parser pipeline, AST shape, and renderer behavior are defined in **[SPEC.md](SPEC.md)**.

## Community

- Report bugs or request features on [GitHub Issues](https://github.com/panorama-lab/markdown/issues)
- Join the [Discord server](https://discord.gg/PtgNPuHMFs)

## License

See [LICENSE](LICENSE).
