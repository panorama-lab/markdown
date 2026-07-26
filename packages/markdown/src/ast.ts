export type Author = {
  name: string;
  email?: string;
  affiliation?: string;
  country?: string;
  corresponding?: boolean;
};

export type FrontMatter = {
  title?: string;
  authors?: Author[];
  abstract?: string;
  keywords?: string[];
};

export type BibEntry = {
  key: string;
  type: string;
  fields: Record<string, string>;
};

export type ReviewComment = {
  id: string;
  by: string;
  at: string;
  re?: string;
  text: string;
};

export type ReviewThread = {
  id: string;
  comments: ReviewComment[];
};

export type Warning = {
  code: string;
  message: string;
};

export type TextNode = {
  type: "text";
  value: string;
};

export type StrongNode = {
  type: "strong";
  children: InlineNode[];
};

export type EmphasisNode = {
  type: "emphasis";
  children: InlineNode[];
};

export type LinkNode = {
  type: "link";
  url: string;
  title?: string;
  children: InlineNode[];
};

export type InlineCodeNode = {
  type: "inlineCode";
  value: string;
};

export type StrikethroughNode = {
  type: "strikethrough";
  children: InlineNode[];
};

export type BreakNode = {
  type: "break";
};

export type CiteNode = {
  type: "cite";
  keys: string[];
};

export type RefNode = {
  type: "ref";
  label: string;
  id: string;
};

export type FootnoteRefNode = {
  type: "footnoteRef";
  id: string;
};

export type AdditionNode = {
  type: "addition";
  children: InlineNode[];
};

export type DeletionNode = {
  type: "deletion";
  children: InlineNode[];
};

export type SubstitutionNode = {
  type: "substitution";
  old: InlineNode[];
  new: InlineNode[];
};

export type HighlightNode = {
  type: "highlight";
  children: InlineNode[];
};

export type CommentMeta = {
  id: string;
  by: string;
  at: string;
  re?: string;
};

export type CommentNode = {
  type: "comment";
  text: string;
  meta?: CommentMeta;
};

export type InlineNode =
  | TextNode
  | StrongNode
  | EmphasisNode
  | LinkNode
  | InlineCodeNode
  | StrikethroughNode
  | BreakNode
  | CiteNode
  | RefNode
  | FootnoteRefNode
  | AdditionNode
  | DeletionNode
  | SubstitutionNode
  | HighlightNode
  | CommentNode;

export type HeadingNode = {
  type: "heading";
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
  id?: string;
};

export type ParagraphNode = {
  type: "paragraph";
  children: InlineNode[];
};

export type ListItemNode = {
  type: "listItem";
  children: BlockNode[];
};

export type ListNode = {
  type: "list";
  ordered: boolean;
  start?: number;
  children: ListItemNode[];
};

export type BlockquoteNode = {
  type: "blockquote";
  children: BlockNode[];
};

export type CodeNode = {
  type: "code";
  lang?: string;
  value: string;
};

export type ThematicBreakNode = {
  type: "thematicBreak";
};

export type FigureNode = {
  type: "figure";
  caption: InlineNode[];
  src: string;
  id?: string;
};

export type TableDirectiveNode = {
  type: "tableDirective";
  caption: InlineNode[];
  src: string;
  id?: string;
  body?: BlockNode[];
};

export type TableCellNode = {
  type: "tableCell";
  children: InlineNode[];
};

export type TableRowNode = {
  type: "tableRow";
  children: TableCellNode[];
};

export type TableNode = {
  type: "table";
  header: TableRowNode;
  rows: TableRowNode[];
};

export type ReferencesNode = {
  type: "references";
};

export type PagebreakNode = {
  type: "pagebreak";
};

export type FootnoteDefinitionNode = {
  type: "footnoteDefinition";
  id: string;
  children: BlockNode[];
};

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | BlockquoteNode
  | CodeNode
  | ThematicBreakNode
  | FigureNode
  | TableDirectiveNode
  | TableNode
  | ReferencesNode
  | PagebreakNode
  | FootnoteDefinitionNode;

export type Document = {
  meta: FrontMatter | null;
  body: BlockNode[];
  bibliography: BibEntry[];
  reviews: ReviewThread[];
  warnings: Warning[];
};

export type ParseOptions = {
  files?: Record<string, string>;
};

export type ReviewMode = "markup" | "clean" | "accepted";

export type PageSize =
  | "LETTER"
  | "LEGAL"
  | "A4"
  | "A3"
  | "A5"
  | "TABLOID"
  | "EXECUTIVE"
  | [width: number, height: number];

export type PaperMargin =
  | number
  | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

export type HeadingFormat = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  textTransform?: "none" | "uppercase" | "capitalize";
  marginTop?: number;
  marginBottom?: number;
  indent?: number;
  numbering?: boolean;
};

export type RenderOptions = {
  assets?: Record<string, string>;
  reviewMode?: ReviewMode;
  pageSize?: PageSize;
  margin?: PaperMargin;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  paragraphIndent?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  titleAlign?: "left" | "center" | "right";
  headings?: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, HeadingFormat>>;
};
