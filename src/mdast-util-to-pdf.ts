import type * as mdast from "mdast";
import type {
  Alignment,
  Content as AllContent,
  ContentText,
  Style,
  StyleDictionary,
  TDocumentDefinitions,
  TDocumentInformation,
  TFontDictionary,
} from "pdfmake/interfaces";
import { definitions, type GetDefinition } from "mdast-util-definitions";
import { deepMerge, isBrowser, warnOnce } from "./utils";

type KnownNodeType = mdast.RootContent["type"];

type MdastNode<T extends string> = T extends KnownNodeType
  ? Extract<mdast.RootContent, { type: T }>
  : unknown;

type NodeBuilder<T extends string> = (
  node: MdastNode<T>,
  ctx: Context,
) => Content | Content[] | null;

type NodeBuilders = {
  [K in KnownNodeType]?: NodeBuilder<K>;
};

type Content = Exclude<AllContent, any[]>;

const HEADING_1 = "head1";
const HEADING_2 = "head2";
const HEADING_3 = "head3";
const HEADING_4 = "head4";
const HEADING_5 = "head5";
const HEADING_6 = "head6";
const EMOJI = "emoji";
const HRULE = "thematicBreak";
const LINK = "link";
const LISTITEM = "listItem";

type DecorationContext = Readonly<{
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  link?: string;
  align?: Alignment;
}>;

type Context = Readonly<{
  render: (node: readonly mdast.RootContent[], ctx?: Context) => Content[];
  /**
   * @internal
   */
  deco: DecorationContext;
  /**
   * @internal
   */
  styles: Readonly<StyleDictionary>;
  /**
   * @internal
   */
  definition: GetDefinition;
}>;

export type PdfBuilder = (
  def: TDocumentDefinitions & { fonts?: TFontDictionary },
) => Promise<Uint8Array>;

export interface PdfOptions extends Pick<
  TDocumentDefinitions,
  | "defaultStyle"
  | "pageMargins"
  | "pageOrientation"
  | "pageSize"
  | "userPassword"
  | "ownerPassword"
  | "permissions"
  | "version"
  | "styles"
  | "watermark"
> {
  info?: TDocumentInformation;
  fonts?: TFontDictionary;
  preventOrphans?: boolean;
}

export async function mdastToPdf(
  node: mdast.Root,
  {
    defaultStyle,
    fonts,
    info,
    pageMargins,
    pageOrientation,
    pageSize,
    userPassword,
    ownerPassword,
    styles,
    permissions,
    version,
    watermark,
    preventOrphans,
  }: PdfOptions,
  build: Promise<{ default: PdfBuilder }>,
): Promise<Uint8Array> {
  const definition = definitions(node);

  const defaultStyles: StyleDictionary = {
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
    [EMOJI]: {},
    [LISTITEM]: {},
    [LINK]: {
      color: "blue",
    },
    [HRULE]: {
      margin: [0, 12, 0, 0],
    },
  };
  const mergedStyles = deepMerge(defaultStyles, styles);

  const builders: NodeBuilders = {
    paragraph: buildParagraph,
    heading: buildHeading,
    thematicBreak: buildThematicBreak,
    blockquote: buildBlockquote,
    list: buildList,
    listItem: buildListItem,
    table: buildTable,
    tableRow: noop,
    tableCell: noop,
    html: fallbackText,
    code: fallbackText,
    definition: noop,
    // footnoteDefinition: buildFootnoteDefinition,
    text: buildText,
    emphasis: buildEmphasis,
    strong: buildStrong,
    delete: buildDelete,
    inlineCode: fallbackText,
    break: buildBreak,
    link: buildLink,
    linkReference: buildLinkReference,
    // image: warnImage,
    // imageReference: warnImage,
    // footnoteReference: buildFootnoteReference,
    math: fallbackText,
    inlineMath: fallbackText,
  };

  const context: Context = {
    render(nodes, c) {
      const results: Content[] = [];
      for (const node of nodes) {
        const builder = builders[node.type];
        if (!builder) {
          warnOnce(`${node.type} node is not supported without plugins.`);
          continue;
        }
        const r = builder(node as any, c ?? this);
        if (r) {
          if (Array.isArray(r)) {
            results.push(...r);
          } else {
            results.push(r);
          }
        }
      }
      return results;
    },
    deco: {},
    styles: mergedStyles,
    definition,
  };

  const content = context.render(node.children);
  const doc = (await build).default({
    info,
    pageMargins,
    pageOrientation,
    pageSize,
    pageBreakBefore: preventOrphans
      ? (currentNode, restNodes) =>
          currentNode.headlineLevel === 1 && restNodes.length === 0
      : undefined,
    userPassword,
    ownerPassword,
    permissions,
    version,
    watermark,
    content,
    images: {},
    fonts,
    styles: mergedStyles,
    defaultStyle: {
      font: isBrowser() ? "Roboto" : "Helvetica",
      ...defaultStyle,
    },
  });
  return doc;
}

const buildParagraph: NodeBuilder<"paragraph"> = ({ type, children }, ctx) => {
  return { text: ctx.render(children), style: type };
};

const buildHeading: NodeBuilder<"heading"> = ({ children, depth }, ctx) => {
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
  return {
    text: ctx.render(children),
    style: heading,
  };
};

const buildThematicBreak: NodeBuilder<"thematicBreak"> = ({ type }, ctx) => {
  const style = { ...ctx.styles[type] };
  return {
    style: type,
    canvas: [
      {
        type: "line",
        lineColor: style.color,
        lineWidth: style.lineHeight || 1,
        x1: 0,
        y1: 0,
        x2: (514 / 100) * 100,
        y2: 0,
      },
    ],
  };
};

const buildBlockquote: NodeBuilder<"blockquote"> = (
  { type, children },
  ctx,
) => {
  // FIXME: do nothing for now
  return { text: ctx.render(children), style: type };
};

const buildList: NodeBuilder<"list"> = (
  { children, ordered, start: _start, spread: _spread, type },
  ctx,
) => {
  const nodes = ctx.render(children);
  return ordered
    ? {
        ol: nodes,
        style: type,
      }
    : {
        ul: nodes,
        style: type,
      };
};

const buildListItem: NodeBuilder<"listItem"> = (
  { children, checked: _checked, spread: _spread },
  ctx,
) => {
  return ctx.render(children);
};

const buildTable: NodeBuilder<"table"> = ({ children, align }, ctx) => {
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

  return {
    table: {
      body: children.map((r) => {
        return r.children.map((c, i) => {
          return ctx.render(c.children, {
            ...ctx,
            deco: { ...ctx.deco, align: cellAligns?.[i] },
          });
        });
      }),
    },
  };
};

const buildText: NodeBuilder<"text"> = ({ value: text }, ctx) => {
  const style: Style = {};
  const content: ContentText = { text, style };
  if (ctx.deco.bold) {
    style.bold = ctx.deco.bold;
  }
  if (ctx.deco.italic) {
    style.italics = ctx.deco.italic;
  }
  if (ctx.deco.strike) {
    content.decoration = "lineThrough";
  }
  if (ctx.deco.align != null) {
    style.alignment = ctx.deco.align;
  }
  if (ctx.deco.link != null) {
    content.link = ctx.deco.link;
    content.style = {
      ...ctx.styles[LINK],
      ...style,
    };
  }

  const matches = text.match(/\p{Extended_Pictographic}/gu);
  if (matches) {
    let segments: ContentText[] = [];
    let lastIndex = 0;
    matches.forEach((emoji: string) => {
      // Add text before emoji
      const textBefore = text.slice(lastIndex, text.indexOf(emoji, lastIndex));
      if (textBefore) {
        segments.push({ ...content, text: textBefore });
      }
      // Add emoji
      segments.push({ ...content, text: emoji, style: EMOJI });
      lastIndex = text.indexOf(emoji, lastIndex) + emoji.length;
    });
    // Add remaining text
    if (lastIndex < text.length) {
      const textAfter = text.slice(lastIndex);
      if (textAfter) {
        segments.push({ ...content, text: textAfter });
      }
    }
    // console.error(content, segments);
    return segments;
  }
  return [content];
};

const buildEmphasis: NodeBuilder<"emphasis"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    deco: { ...ctx.deco, italic: true },
  });
};

const buildStrong: NodeBuilder<"strong"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    deco: { ...ctx.deco, bold: true },
  });
};

const buildDelete: NodeBuilder<"delete"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    deco: { ...ctx.deco, strike: true },
  });
};

const buildBreak: NodeBuilder<"break"> = ({}, ctx) => {
  return buildText({ type: "text", value: "\n" }, ctx);
};

const buildLink: NodeBuilder<"link"> = (
  { children, url, title: _title },
  ctx,
) => {
  if (url.startsWith("#")) {
    // TODO support anchor link
    return ctx.render(children);
  }
  return ctx.render(children, { ...ctx, deco: { ...ctx.deco, link: url } });
};

// const buildImage: NodeBuilder<"image"> = ({
//   url,
//   title: _title,
//   alt: _alt,
// }) => {
//   return { image: url /* width, height*/ };
// };

const buildLinkReference: NodeBuilder<"linkReference"> = (
  { children, identifier },
  ctx,
) => {
  const def = ctx.definition(identifier);
  if (def == null) {
    return ctx.render(children);
  }
  return buildLink({ type: "link", children, url: def.url }, ctx);
};

const noop = () => {
  return null;
};

const fallbackText = (node: { type: string; value: string }, ctx: Context) => {
  warnOnce(
    `${node.type} node is not supported without plugins, falling back to text.`,
  );
  return buildText({ type: "text", value: node.value }, ctx);
};
