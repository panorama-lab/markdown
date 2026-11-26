export function formulaProps(value: string, display: boolean, markup?: string) {
  return {
    role: "math",
    "aria-label": value,
    style: display
      ? { overflowX: "auto", textAlign: "center" as const, marginBlock: "1em" }
      : undefined,
    dangerouslySetInnerHTML: markup ? { __html: markup } : undefined,
  };
}
