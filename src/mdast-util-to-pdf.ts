import type * as mdast from "mdast";
import { warnOnce } from "./utils";
import { definitions } from "mdast-util-definitions";
import type {
  Context,
  FontType,
  NodeBuilder,
  NodeBuilders,
  PdfContent,
} from "./types";
import { printPdf } from "./printer";

export interface PdfOptions {
  info?: {
    /** Document title. */
    title?: string | undefined;

    /** Name of the author. */
    author?: string | undefined;

    /** Subject of the document. */
    subject?: string | undefined;

    /**
     * Keywords associated with the document.
     *
     * A PDF file stores all keywords as a single string, as given here.
     * For optimal compatibility, separate keywords using commas or spaces.
     */
    keywords?: string | undefined;

    /**
     * Name of the creator.
     *
     * Defaults to `pdfmake`.
     */
    creator?: string | undefined;

    /**
     * Name of the producer.
     *
     * Defaults to `pdfmake`.
     */
    producer?: string | undefined;

    /**
     * Date the document was created.
     *
     * Defaults to the current date and time.
     */
    creationDate?: Date | undefined;

    /** Date the document was last modified. */
    modDate?: Date | undefined;

    /** Indicates whether the document has been corrected for color misregistrations. */
    trapped?: "True" | "False" | "Unknown" | undefined;
  };
  font?: FontType;
  preventOrphans?: boolean;
}

export async function mdastToPdf(
  node: mdast.Root,
  {
    info,
    preventOrphans,
    // https://github.com/Hopding/pdf-lib?tab=readme-ov-file#creating-and-filling-forms
    font: fontProp = "Helvetica",
  }: PdfOptions,
): Promise<Uint8Array> {
  const definition = definitions(node);

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
      const results: PdfContent[] = [];
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
    config: {
      head1: {
        fontSize: 24,
      },
      head2: {
        fontSize: 22,
      },
      head3: {
        fontSize: 20,
      },
      head4: {
        fontSize: 18,
      },
      head5: {
        fontSize: 16,
      },
      head6: {
        fontSize: 14,
      },
    },
    style: {},
    definition,
  };

  const content = context.render(node.children);

  return printPdf(content, {
    pageSize: "A4",
    font: fontProp,
    margin: {
      top: 40,
      left: 40,
      bottom: 40,
      right: 40,
    },
  });
}

const buildParagraph: NodeBuilder<"paragraph"> = ({ children }, ctx) => {
  return {
    type: "paragraph",
    children: ctx.render(children),
  };
};

const buildHeading: NodeBuilder<"heading"> = ({ children, depth }, ctx) => {
  const style = ctx.config[`head${depth}`];
  return {
    type: "paragraph",
    heading: depth,
    children: ctx.render(children, {
      ...ctx,
      style: {
        ...ctx.style,
        fontSize: style.fontSize,
      },
    }),
  };
};

const buildThematicBreak: NodeBuilder<"thematicBreak"> = () => {
  return { type: "pagebreak" };
};

const buildBlockquote: NodeBuilder<"blockquote"> = ({ children }, ctx) => {
  // FIXME: do nothing for now
  return ctx.render(children);
};

const buildList: NodeBuilder<"list"> = ({ children, ordered }, ctx) => {
  return ctx.render(children);
  // return {
  //   type: "paragraph",
  //   children: nodes,
  //   // style: type,
  // };
};

const buildListItem: NodeBuilder<"listItem"> = (
  { children, checked: _checked },
  ctx,
) => {
  return ctx.render(children);
};

const buildTable: NodeBuilder<"table"> = ({ children, align }, ctx) => {
  const cellAligns = align?.map((a) => {
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
    type: "table",
    children: children.map((r) => {
      return r.children.map((c, i) => {
        return {
          type: "paragraph",
          align: cellAligns?.[i],
          children: ctx.render(c.children),
        };
      });
    }),
  };
};

const buildText: NodeBuilder<"text"> = ({ value: text }, ctx) => {
  // const matches = text.match(/\p{Extended_Pictographic}/gu);
  // if (matches) {
  //   let segments: ContentText[] = [];
  //   let lastIndex = 0;
  //   matches.forEach((emoji: string) => {
  //     // Add text before emoji
  //     const textBefore = text.slice(lastIndex, text.indexOf(emoji, lastIndex));
  //     if (textBefore) {
  //       segments.push({ ...content, text: textBefore });
  //     }
  //     // Add emoji
  //     segments.push({ ...content, text: emoji, style: EMOJI });
  //     lastIndex = text.indexOf(emoji, lastIndex) + emoji.length;
  //   });
  //   // Add remaining text
  //   if (lastIndex < text.length) {
  //     const textAfter = text.slice(lastIndex);
  //     if (textAfter) {
  //       segments.push({ ...content, text: textAfter });
  //     }
  //   }
  //   // console.error(content, segments);
  //   return segments;
  // }
  // return [content];
  // emoji https://github.com/Hopding/pdf-lib/issues/217
  // font https://crocro.com/news/20220517231535.html
  return { type: "text", text, style: ctx.style };
};

const buildEmphasis: NodeBuilder<"emphasis"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    style: { ...ctx.style, italic: true },
  });
};

const buildStrong: NodeBuilder<"strong"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    style: { ...ctx.style, bold: true },
  });
};

const buildDelete: NodeBuilder<"delete"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    style: { ...ctx.style, strike: true },
  });
};

const buildBreak: NodeBuilder<"break"> = ({}, ctx) => {
  return buildText({ type: "text", value: "\n" }, ctx);
};

const buildLink: NodeBuilder<"link"> = ({ children, url }, ctx) => {
  if (url.startsWith("#")) {
    // TODO support anchor link
    return ctx.render(children);
  }
  return ctx.render(children, { ...ctx, style: { ...ctx.style, link: url } });
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
