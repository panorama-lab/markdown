# Panorama Markdown

> [!NOTE]
> This is preview software — feedback is welcome.

Panorama Markdown is a small dialect for writing academic papers and for representing parsed PDF papers in Markdown.

The main idea is to be LLM-friendly while staying simple enough for humans to write.

## Built on Markdown

- **Standard Markdown** for headings, paragraphs, lists, links, footnotes, and emphasis
- **YAML front matter** for title, authors, abstract, and keywords
- **Citations** via `:cite` and a `::references` block backed by BibTeX
- **Figures and tables** are not embedded in Markdown but imported with directive syntax
- **Cross-references** via `:ref` to labeled sections, figures, and tables

## Specification

The specification is still in progress.

A paper is a flat directory of files. The full directory layout and Markdown syntax are defined in **[SPEC.md](SPEC.md)**.

## Typesetting

Markdown handles the content; layout and styling are kept separate. The current tooling can export APA-style PDFs, with more styling options planned.

## Editor

![Panorama Markdown screenshot](assets/screenshot.png)

Download the latest editor build from the [GitHub releases page](https://github.com/panorama-lab/markdown/releases).

After downloading, open or create a paper directory to edit and export PDFs. Click the Agent button in the top-right to copy prompts to your agent (Codex, Claude) and collaborate with it.

## Community

- Report bugs or request features on [GitHub Issues](https://github.com/panorama-lab/markdown/issues)
- Join the [Discord server](https://discord.gg/PtgNPuHMFs)

## License

Apache 2.0
