import type { PageSizes } from "pdf-lib";
import type { GetDefinition } from "mdast-util-definitions";
import type * as mdast from "mdast";

export type PageSize = keyof typeof PageSizes;

export type StandardFontType =
  | "Courier"
  | "Helvetica"
  | "TimesRoman"
  | "Symbol"
  | "ZapfDingbats";
type FontData = Uint8Array | ArrayBuffer;
interface ProvidedFont {
  normal: FontData;
  bold?: FontData;
  italic?: FontData;
  bolditalic?: FontData;
}
export type FontType = StandardFontType | ProvidedFont;

type KnownNodeType = mdast.RootContent["type"];

type MdastNode<T extends string> = T extends KnownNodeType
  ? Extract<mdast.RootContent, { type: T }>
  : unknown;

type ConfigStyle = { fontSize: number };

export type Context = Readonly<{
  render: (node: readonly mdast.RootContent[], ctx?: Context) => PdfContent[];
  /**
   * @internal
   */
  config: {
    head1: ConfigStyle;
    head2: ConfigStyle;
    head3: ConfigStyle;
    head4: ConfigStyle;
    head5: ConfigStyle;
    head6: ConfigStyle;
  };
  /**
   * @internal
   */
  style: StyleContext;
  /**
   * @internal
   */
  definition: GetDefinition;
}>;

export type NodeBuilder<T extends string> = (
  node: MdastNode<T>,
  ctx: Context,
) => PdfContent | PdfContent[] | null;

export type NodeBuilders = {
  [K in KnownNodeType]?: NodeBuilder<K>;
};

export type StyleContext = Readonly<{
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  link?: string;
}>;

export type PdfContent = PdfParagraph | PdfTable | PdfText | PdfPageBreak;

export interface PdfParagraph {
  readonly type: "paragraph";
  readonly align?: "left" | "right" | "center";
  readonly children: PdfContent[];
}

export interface PdfTable {
  readonly type: "table";
  readonly children: PdfContent[][];
}

export interface PdfText {
  readonly type: "text";
  readonly text: string;
  readonly style: StyleContext;
}

export interface PdfPageBreak {
  readonly type: "pagebreak";
}
