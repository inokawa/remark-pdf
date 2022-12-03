import * as mdast from "./models/mdast";
import type {
  Alignment,
  Content as AllContent,
  ContentCanvas,
  ContentImage,
  ContentOrderedList,
  ContentTable,
  ContentText,
  ContentUnorderedList,
  Style,
  TableCell,
  TDocumentDefinitions,
  TDocumentInformation,
} from "pdfmake/interfaces";
import { error, isBrowser } from "./utils";

type Content = Exclude<AllContent, any[]>;

const HEADING_1 = "head1";
const HEADING_2 = "head2";
const HEADING_3 = "head3";
const HEADING_4 = "head4";
const HEADING_5 = "head5";
const HEADING_6 = "head6";

export type ImageDataMap = { [url: string]: string };

export type ImageData = {
  // image: string;
  // width: number;
  // height: number;
};

export type ImageResolver = (url: string) => Promise<ImageData> | ImageData;

type Decoration = Readonly<
  {
    [key in (mdast.Emphasis | mdast.Strong | mdast.Delete)["type"]]?: true;
  } & { link?: string; align?: Alignment }
>;

type Context = {
  readonly deco: Decoration;
  readonly images: ImageDataMap;
};

export interface PdfOptions
  extends Pick<
    TDocumentDefinitions,
    | "pageMargins"
    | "pageOrientation"
    | "pageSize"
    | "userPassword"
    | "ownerPassword"
    | "permissions"
    | "version"
    | "watermark"
  > {
  /**
   * Set output type of `VFile.result`. `buffer` is `Promise<Buffer>`. `blob` is `Promise<Blob>`.
   * @defaultValue "buffer"
   */
  output?: "buffer" | "blob";
  /**
   * **You must set** if your markdown includes images.
   */
  imageResolver?: ImageResolver;
  info?: TDocumentInformation;
}

export function mdastToPdf(
  node: mdast.Root,
  {
    output,
    info,
    pageMargins,
    pageOrientation,
    pageSize,
    userPassword,
    ownerPassword,
    permissions,
    version,
    watermark,
  }: PdfOptions,
  images: ImageDataMap,
  build: (def: TDocumentDefinitions) => Promise<any>
): Promise<any> {
  const content = convertNodes(node.children, { deco: {}, images });
  const doc = build({
    info,
    pageMargins,
    pageOrientation,
    pageSize,
    userPassword,
    ownerPassword,
    permissions,
    version,
    watermark,
    content,
    images,
    defaultStyle: {
      font: isBrowser() ? "Roboto" : "Helvetica",
    },
    styles: {
      [HEADING_1]: {
        fontSize: 24,
      },
      [HEADING_2]: {
        fontSize: 22,
      },
      [HEADING_3]: {
        fontSize: 20,
      },
      [HEADING_4]: {
        fontSize: 18,
      },
      [HEADING_5]: {
        fontSize: 16,
      },
      [HEADING_6]: {
        fontSize: 14,
      },
    },
  });
  return doc;
}

function convertNodes(nodes: mdast.Content[], ctx: Context) {
  const results: Content[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        results.push(buildParagraph(node, ctx));
        break;
      case "heading":
        results.push(buildHeading(node, ctx));
        break;
      case "thematicBreak":
        results.push(buildThematicBreak(node, ctx));
        break;
      case "blockquote":
        results.push(buildBlockquote(node, ctx));
        break;
      case "list":
        results.push(buildList(node, ctx));
        break;
      case "listItem":
        error("unreachable");
        break;
      case "table":
        results.push(buildTable(node, ctx));
        break;
      case "tableRow":
        error("unreachable");
        break;
      case "tableCell":
        error("unreachable");
        break;
      case "html":
        results.push(buildHtml(node, ctx));
        break;
      case "code":
        results.push(buildCode(node, ctx));
        break;
      case "yaml":
        // FIXME: unimplemented
        break;
      case "toml":
        // FIXME: unimplemented
        break;
      case "definition":
        // FIXME: unimplemented
        break;
      case "footnoteDefinition":
        // FIXME: unimplemented
        break;
      case "text":
        results.push(buildText(node.value, ctx));
        break;
      case "emphasis":
      case "strong":
      case "delete": {
        const { type, children } = node;
        results.push(
          ...convertNodes(children, {
            ...ctx,
            deco: { ...ctx.deco, [type]: true },
          })
        );
        break;
      }
      case "inlineCode":
        // FIXME: transform to text for now
        results.push(buildText(node.value, ctx));
        break;
      case "break":
        results.push(buildBreak(node, ctx));
        break;
      case "link":
        results.push(...buildLink(node, ctx));
        break;
      case "image":
        results.push(buildImage(node, ctx.images));
        break;
      case "linkReference":
        // FIXME: unimplemented
        break;
      case "imageReference":
        // FIXME: unimplemented
        break;
      case "footnote":
        results.push(...buildFootnote(node, ctx));
        break;
      case "footnoteReference":
        // FIXME: unimplemented
        break;
      case "math":
        results.push(buildMath(node, ctx));
        break;
      case "inlineMath":
        results.push(buildInlineMath(node, ctx));
        break;
      default:
        const _: never = node;
        break;
    }
  }
  return results;
}

function buildParagraph({ type, children }: mdast.Paragraph, ctx: Context) {
  return <ContentText>{ text: convertNodes(children, ctx) };
}

function buildHeading({ type, children, depth }: mdast.Heading, ctx: Context) {
  let heading: string;
  switch (depth) {
    case 1:
      heading = HEADING_1;
      break;
    case 2:
      heading = HEADING_2;
      break;
    case 3:
      heading = HEADING_3;
      break;
    case 4:
      heading = HEADING_4;
      break;
    case 5:
      heading = HEADING_5;
      break;
    case 6:
      heading = HEADING_6;
      break;
  }
  return <ContentText>{
    text: convertNodes(children, ctx),
    style: heading,
  };
}

function buildThematicBreak({ type }: mdast.ThematicBreak, ctx: Context) {
  return <ContentCanvas>{
    margin: [0, 12, 0, 0],
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: (514 / 100) * 100,
        y2: 0,
      },
    ],
  };
}

function buildBlockquote({ type, children }: mdast.Blockquote, ctx: Context) {
  // FIXME: do nothing for now
  return <ContentText>{ text: convertNodes(children, ctx) };
}

function buildList(
  { type, children, ordered, start, spread }: mdast.List,
  ctx: Context
) {
  return ordered
    ? <ContentOrderedList>{
        ol: children.map((l) => buildListItem(l, ctx)),
      }
    : <ContentUnorderedList>{
        ul: children.map((l) => buildListItem(l, ctx)),
      };
}

function buildListItem(
  { type, children, checked, spread }: mdast.ListItem,
  ctx: Context
) {
  return convertNodes(children, ctx);
}

function buildTable({ type, children, align }: mdast.Table, ctx: Context) {
  const cellAligns: Alignment[] | undefined = align?.map((a) => {
    switch (a) {
      case "left":
        return "left";
      case "right":
        return "right";
      case "center":
        return "center";
      default:
        return "left";
    }
  });

  return <ContentTable>{
    table: {
      body: children.map((r) => {
        return buildTableRow(r, ctx, cellAligns);
      }),
    },
  };
}

function buildTableRow(
  { type, children }: mdast.TableRow,
  ctx: Context,
  cellAligns: Alignment[] | undefined
) {
  return children.map((c, i) => {
    return buildTableCell(c, ctx, cellAligns?.[i]);
  });
}

function buildTableCell(
  { type, children }: mdast.TableCell,
  ctx: Context,
  align: Alignment | undefined
) {
  return <TableCell>(
    convertNodes(children, { ...ctx, deco: { ...ctx.deco, align } })
  );
}

function buildHtml({ type, value }: mdast.HTML, ctx: Context) {
  // FIXME: transform to text for now
  return <ContentText>{ text: buildText(value, ctx) };
}

function buildCode({ type, value, lang, meta }: mdast.Code, ctx: Context) {
  // FIXME: transform to text for now
  return <ContentText>{ text: buildText(value, ctx) };
}

function buildMath({ type, value }: mdast.Math, ctx: Context) {
  // FIXME: transform to text for now
  return <ContentText>{ text: buildText(value, ctx) };
}

function buildInlineMath({ type, value }: mdast.InlineMath, ctx: Context) {
  // FIXME: transform to text for now
  return buildText(value, ctx);
}

function buildText(text: string, ctx: Context) {
  const content: ContentText = { text };
  if (ctx.deco.strong) {
    ((content.style || (content.style = {})) as Style).bold = ctx.deco.strong;
  }
  if (ctx.deco.emphasis) {
    ((content.style || (content.style = {})) as Style).italics =
      ctx.deco.emphasis;
  }
  if (ctx.deco.delete) {
    content.decoration = "lineThrough";
  }
  if (ctx.deco.link != null) {
    content.link = ctx.deco.link;
    content.color = "blue";
  }
  if (ctx.deco.align != null) {
    ((content.style || (content.style = {})) as Style).alignment =
      ctx.deco.align;
  }

  return content;
}

function buildBreak({ type }: mdast.Break, ctx: Context) {
  return buildText("", ctx);
}

function buildLink({ type, children, url, title }: mdast.Link, ctx: Context) {
  return convertNodes(children, { ...ctx, deco: { ...ctx.deco, link: url } });
}

function buildImage(
  { type, url, title, alt }: mdast.Image,
  images: ImageDataMap
) {
  return <ContentImage>{ image: url /* width, height*/ };
}

function buildFootnote({ type, children }: mdast.Footnote, ctx: Context) {
  // FIXME: unimplemented
  return convertNodes(children, ctx);
}
