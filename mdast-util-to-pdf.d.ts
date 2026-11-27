import { VFile } from 'vfile';
import { ToPngFn } from './utils';
import { Alignment } from './layout';
import type * as mdast from "mdast";
type StandardFontType = "Courier" | "Helvetica" | "Symbol" | "Times" | "ZapfDingbats";
type FontBuffer = ArrayBuffer | Uint8Array;
/**
 * Custom font definition.
 */
export interface CustomFont {
    name: string;
    normal: FontBuffer;
    bold?: FontBuffer;
    italic?: FontBuffer;
    bolditalic?: FontBuffer;
}
export type TextStyleMatcher = [pattern: RegExp, style: Partial<TextStyle>];
interface BlockStyle {
    indent?: number;
    display: "block" | "table" | "table-row" | "table-cell";
    textAlign?: Alignment;
}
export interface BlockNode {
    type: "block";
    style: BlockStyle;
    children: PdfLayout[];
}
interface PageBreakNode {
    type: "pagebreak";
}
export interface HorizontalRuleNode {
    type: "hr";
    style: {
        color: string;
        thickness: number;
        margin: number;
    };
}
export interface TextNode {
    type: "text";
    text: string;
    style: TextStyle;
    attrs: {
        link?: string;
    };
}
export interface VoidNode {
    type: "void";
    tag: "image";
    attrs: {
        src: string;
    };
}
type PdfLayout = BlockNode | PageBreakNode | HorizontalRuleNode | TextNode | VoidNode;
interface TextStyle {
    fontSize: number;
    font: string;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
}
interface StyleOption {
    head1: Partial<TextStyle>;
    head2: Partial<TextStyle>;
    head3: Partial<TextStyle>;
    head4: Partial<TextStyle>;
    head5: Partial<TextStyle>;
    head6: Partial<TextStyle>;
    link: Partial<TextStyle>;
    inlineCode: Partial<TextStyle>;
    code: Partial<TextStyle>;
    blockquote: Partial<TextStyle>;
}
export type PdfImageData = Readonly<{
    width: number;
    height: number;
} & ({
    type: "png" | "jpg";
    data: ArrayBuffer;
} | {
    type: "svg";
    data: string;
})>;
/**
 * How thematic break (`---`) is rendered.
 */
export type ThematicBreakStyle = "line" | "pagebreak";
type LoadFn = (url: string, file: VFile) => Promise<ArrayBuffer | Uint8Array>;
export interface ImageOptions {
    /**
     * A function to resolve image data from url. `file` is the processed file, which can be used to resolve relative urls.
     * @default {@link loadWithFetch}
     */
    load?: LoadFn;
    /**
     * A function to convert images to PNG. Required to embed images other than PNG, JPEG and SVG, such as GIF and WebP.
     * On browser, you can use {@link browserToPng}.
     */
    toPng?: ToPngFn;
}
export interface PdfOptions {
    /**
     * Standard fonts or privided custom fonts.
     * @default "Helvetica"
     */
    fonts?: (StandardFontType | CustomFont)[];
    /**
     * Page size.
     * https://pdfkit.org/docs/paper_sizes.html
     * @default A4
     */
    size?: "A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8" | "A9" | "A10" | "B0" | "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7" | "B8" | "B9" | "B10" | "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9" | "C10";
    /**
     * Page margin.
     * @default 40
     */
    margin?: number | {
        top?: number;
        left?: number;
        bottom?: number;
        right?: number;
    };
    /**
     * Page orientation.
     * @default "portrait"
     */
    orientation?: "portrait" | "landscape";
    /**
     * Spacing after Paragraphs.
     * @default undefined
     */
    spacing?: number;
    /**
     * How thematic break (`---`) is rendered.
     * - `"line"`: a horizontal line.
     * - `"pagebreak"`: a page break.
     * @default "pagebreak"
     */
    thematicBreak?: ThematicBreakStyle;
    /**
     * Styles that override the defaults.
     */
    styles?: Partial<StyleOption> & {
        default?: Partial<TextStyle>;
    };
    /**
     * An option to find text and apply style (e.g. font to emoji)
     */
    textStyle?: TextStyleMatcher[];
    /**
     * Embed images of `image` / `imageReference` nodes. `png`, `jpg` and `svg` are supported.
     * Images are not embedded if not set.
     */
    image?: boolean | ImageOptions;
}
export declare function mdastToPdf(node: mdast.Root, { fonts, size: pageSize, margin, orientation, spacing, thematicBreak, styles: { default: defaultStyle, ...style }, image, textStyle: textStyle, }: PdfOptions | undefined, imageCache: ImageCache, file: VFile): Promise<Uint8Array>;
export {};
