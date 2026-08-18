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

## PDF render

```ts
import { parse } from "@panorama-lab/markdown";
import { render } from "@panorama-lab/markdown/pdf";

const element = render(parse(source), { reviewMode: "accepted" });
```

## License

Apache-2.0
