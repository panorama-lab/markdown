# @panorama-lab/markdown

Panorama Markdown parser and renderers for academic papers

See [SPEC.md](./SPEC.md) for the full dialect.

## Install

```sh
pnpm add @panorama-lab/markdown
```

## Parse

```ts
import { parse } from "@panorama-lab/markdown";

const doc = parse(source, { files: { "references.bib": bib } });
```

## React render

```ts
import { parse } from "@panorama-lab/markdown";
import { render } from "@panorama-lab/markdown/react";

const tree = render(parse(source), { reviewMode: "markup" });
```

`reviewMode`: `"markup"` | `"clean"` | `"accepted"`.

Citations and the references list render in APA style by default (`citationStyle: "apa"`), e.g. `(Smith, 2024)` and `Smith, J. (2024). Title. Journal, 12(3), 45–50.`.

## Review markers

`listCriticMarkers(source)` lists the review spans recognized by the parser, including nested spans. Escaped text, code, front matter, and link destinations do not produce review markers.

```ts
import { listCriticMarkers, parse } from "@panorama-lab/markdown";

const document = parse(source, { files });
const markers = listCriticMarkers(document);
const editableMarkers = markers.filter((marker) => marker.file === undefined);
```

Each marker has an `id` matching the React renderer's `data-review-id`, plus `start`, `end`, `contentStart`, and `contentEnd` offsets into the original source. IDs identify source locations, so they do not depend on render order. Reparse after editing to refresh IDs and offsets. Markers from external table files include a `file` path and have IDs scoped to that file; their offsets refer to that file's content.

## PDF render

```ts
import { parse } from "@panorama-lab/markdown";
import { render } from "@panorama-lab/markdown/pdf";

const element = render(parse(source), { reviewMode: "accepted" });
```

## License

Apache-2.0
