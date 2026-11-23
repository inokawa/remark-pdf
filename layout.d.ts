import { BlockNode, HorizontalRuleNode, VoidNode, TextNode } from './mdast-util-to-pdf';
export type Alignment = "left" | "right" | "center";
interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export interface BlockBox extends Box {
    readonly type: "block";
    readonly border: boolean;
    readonly children: LayoutBox[];
}
export interface TextBox extends Box {
    readonly type: "text";
    readonly node: TextNode;
    readonly font: string;
    readonly text: string;
}
export interface ImageBox extends Box {
    readonly type: "image";
    readonly node: VoidNode;
}
export interface RuleBox extends Box {
    readonly type: "hr";
    readonly node: HorizontalRuleNode;
}
type InlineBox = TextBox | ImageBox;
export type LayoutBox = InlineBox | BlockBox | RuleBox | {
    type: "pagebreak";
};
export type TextWidth = (str: string) => number;
export type TextHeight = (font?: string, fontSize?: number) => number;
export type ResolveFont = (font: string, bold: boolean, italic: boolean) => string;
export type ResolveImageSize = (src: string) => {
    width: number;
    height: number;
} | null;
interface Options {
    readonly top: number;
    readonly width: number;
    readonly spacing?: number;
    readonly textWidth: TextWidth;
    readonly textHeight: TextHeight;
    readonly resolveFont: ResolveFont;
    readonly resolveImageSize: ResolveImageSize;
}
export declare const layoutBlock: ({ children, style }: BlockNode, startX: number, startY: number, options: Options) => BlockBox;
export {};
