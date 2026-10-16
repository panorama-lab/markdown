export class SourceText {
  constructor(
    readonly value: string,
    readonly original = value,
    readonly positions = Array.from({ length: value.length }, (_, index) => index),
    readonly file?: string,
  ) {}

  slice(start = 0, end = this.value.length): SourceText {
    return new SourceText(
      this.value.slice(start, end),
      this.original,
      this.positions.slice(start, end),
      this.file,
    );
  }

  trim(): SourceText {
    const start = this.value.length - this.value.trimStart().length;
    return this.slice(start, start + this.value.trim().length);
  }

  replace(pattern: RegExp, replacement: string): SourceText {
    const positions: number[] = [];
    let cursor = 0;
    const value = this.value.replace(pattern, (match: string, offset: number) => {
      for (let index = cursor; index < offset; index += 1) positions.push(this.positions[index]);
      for (let index = 0; index < replacement.length; index += 1) {
        positions.push(this.positions[offset + Math.min(index, match.length - 1)]);
      }
      cursor = offset + match.length;
      return replacement;
    });
    for (let index = cursor; index < this.positions.length; index += 1)
      positions.push(this.positions[index]);
    return new SourceText(value, this.original, positions, this.file);
  }

  split(separator: string): SourceText[] {
    let start = 0;
    return this.value.split(separator).map((part) => {
      const result = this.slice(start, start + part.length);
      start += part.length + separator.length;
      return result;
    });
  }

  static join(parts: SourceText[], separator: string): SourceText {
    const first = parts[0];
    if (!first) return new SourceText("");
    const positions = parts.flatMap((part, index) => [
      ...(index > 0 ? Array(separator.length).fill(parts[index - 1].positions.at(-1) ?? 0) : []),
      ...part.positions,
    ]);
    return new SourceText(
      parts.map((part) => part.value).join(separator),
      first.original,
      positions,
      first.file,
    );
  }
}
