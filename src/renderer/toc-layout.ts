import { Button } from "@heroui/react";
import { createElement, useId, useState, type ReactNode } from "react";

import type { TocEntry } from "./headings.ts";

type Props = { entries: TocEntry[]; children: ReactNode };

export function TableOfContentsLayout({ entries, children }: Props) {
  const [expanded, setExpanded] = useState(true);
  const sidebarId = useId();
  const depth = Math.min(...entries.map((entry) => entry.depth));

  return createElement(
    "div",
    { "data-toc-layout": true },
    createElement(
      "div",
      { className: "not-prose", style: { marginBottom: 16 } },
      createElement(
        Button,
        {
          size: "sm",
          variant: "ghost",
          "aria-expanded": expanded,
          "aria-controls": sidebarId,
          onPress: () => setExpanded((value) => !value),
        },
        expanded ? "Hide contents" : "Show contents",
      ),
    ),
    createElement(
      "div",
      { style: { display: "flex", alignItems: "flex-start", gap: expanded ? 24 : 0 } },
      createElement(
        "aside",
        {
          id: sidebarId,
          hidden: !expanded,
          className: "not-prose",
          style: {
            position: "sticky",
            top: 16,
            width: 180,
            flexShrink: 0,
            maxHeight: "calc(100vh - 12rem)",
            overflowY: "auto",
            fontSize: 12,
            lineHeight: 1.6,
          },
        },
        createElement(
          "nav",
          { "aria-label": "Table of contents" },
          createElement("p", { style: { margin: "0 0 12px", fontWeight: 600 } }, "Contents"),
          createElement(
            "ul",
            { style: { listStyle: "none", padding: 0, margin: 0 } },
            ...entries.map((entry) =>
              createElement(
                "li",
                {
                  key: entry.id,
                  style: { paddingLeft: (entry.depth - depth) * 12, marginBottom: 8 },
                },
                createElement(
                  "a",
                  {
                    href: `#${encodeURIComponent(entry.id)}`,
                    style: {
                      display: "block",
                      overflowWrap: "anywhere",
                      color: "inherit",
                      textDecoration: "none",
                    },
                  },
                  entry.text,
                ),
              ),
            ),
          ),
        ),
      ),
      createElement("div", { style: { flex: 1, minWidth: 0 } }, children),
    ),
  );
}
