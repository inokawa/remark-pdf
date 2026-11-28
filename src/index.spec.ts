import { describe, it, expect } from "vitest";
import * as fs from "fs/promises";
import path from "path";
import { unified } from "unified";
import markdown from "remark-parse";
import gfm from "remark-gfm";
import frontmatter from "remark-frontmatter";
import math from "remark-math";
import pdf, { type PdfOptions } from "./plugin";
import { latexPlugin } from "./plugins/latex";
import { pdf as pdfToImage } from "pdf-to-img";
import {
  toMatchImageSnapshot,
  type MatchImageSnapshotOptions,
} from "jest-image-snapshot";
import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

const FIXTURE_PATH = "../fixtures";
const fixturesDir = path.join(__dirname, FIXTURE_PATH);

declare module "vitest" {
  interface Matchers<R, T> {
    toMatchImageSnapshot(options?: MatchImageSnapshotOptions): R;
  }
}

expect.extend({ toMatchImageSnapshot });

const getPdfText = async (buffer: Uint8Array): Promise<string> => {
  // pdfjs may detach the given buffer, so pass a copy
  const pdfData = buffer.slice();

  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;

  return (
    await Promise.all(
      Array.from({ length: pdf.numPages }).map(async (_, i) => {
        const pageNumber = i + 1;
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        return content.items
          .filter((i) => "str" in i)
          .map((i) => i.str + (i.hasEOL ? "\n" : ""))
          .join("");
      }),
    )
  ).join("\n");
};

const getPdfTextItems = async (buffer: Uint8Array): Promise<TextItem[]> => {
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice() }).promise;
  return (await (await pdf.getPage(1)).getTextContent()).items.filter(
    (i) => "str" in i,
  );
};

// Links per page, with internal ones resolved to the page and top of their
// destinations
const getPdfLinks = async (buffer: Uint8Array): Promise<string[][]> => {
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice() }).promise;
  return Promise.all(
    Array.from({ length: pdf.numPages }).map(async (_, i) => {
      const page = await pdf.getPage(i + 1);
      const annotations = await page.getAnnotations();
      return Promise.all(
        annotations
          .filter((a) => a.subtype === "Link")
          .map(async (a) => {
            if (a.url) {
              return a.url as string;
            }
            const dest =
              typeof a.dest === "string"
                ? await pdf.getDestination(a.dest)
                : a.dest;
            if (!dest) {
              return `#${a.dest} (missing)`;
            }
            const pageIndex = await pdf.getPageIndex(dest[0]);
            return `#${a.dest} -> page ${pageIndex + 1}, top ${Math.round(dest[3])}`;
          }),
      );
    }),
  );
};

const getPdfOutline = async (buffer: Uint8Array): Promise<string[]> => {
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice() }).promise;
  const lines: string[] = [];
  const walk = async (
    items: Awaited<ReturnType<typeof pdf.getOutline>>,
    indent: string,
  ): Promise<void> => {
    for (const item of items ?? []) {
      const dest = item.dest as unknown[];
      const pageIndex = await pdf.getPageIndex(dest[0] as never);
      const [left, top] = (dest.slice(2, 4) as number[]).map(Math.round);
      lines.push(
        `${indent}${item.title} -> page ${pageIndex + 1}, left ${left}, top ${top}${item.count! > 0 ? ", expanded" : ""}`,
      );
      await walk(item.items, indent + "  ");
    }
  };
  await walk(await pdf.getOutline(), "");
  return lines;
};

// glyphs as wide as their fonts make them
const getPdfTextRight = async (buffer: Uint8Array): Promise<number> => {
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice() }).promise;
  let right = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const ops = await (await pdf.getPage(i)).getOperatorList();
    let x = 0;
    let size = 0;
    ops.fnArray.forEach((fn, k) => {
      const args = ops.argsArray[k];
      if (fn === pdfjsLib.OPS.setTextMatrix) {
        x = args[0][4];
      } else if (fn === pdfjsLib.OPS.setFont) {
        size = args[1];
      } else if (fn === pdfjsLib.OPS.showText) {
        const width = (args[0] as ({ width: number } | number)[]).reduce(
          (acc: number, g) => acc + (typeof g === "number" ? -g : g.width),
          0,
        );
        right = Math.max(right, x + (width / 1000) * size);
      }
    });
  }
  return right;
};

const getPdfMarkedContents = async (buffer: Uint8Array): Promise<string[]> => {
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice() }).promise;
  const tags: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const ops = await (await pdf.getPage(i)).getOperatorList();
    ops.fnArray.forEach((fn, k) => {
      if (fn === pdfjsLib.OPS.beginMarkedContent) {
        tags.push(ops.argsArray[k][0].name);
      }
    });
  }
  return tags;
};

const dummyImage = async (): Promise<ArrayBuffer> => {
  const img = await fs.readFile(path.join(fixturesDir, "images/img.png"));

  return img.buffer;
};

describe("e2e", () => {
  const processor = (options: PdfOptions = {}) => {
    return unified()
      .use(markdown)
      .use(gfm)
      .use(frontmatter, ["yaml", "toml"])
      .use(math)
      .use(pdf, { image: { load: dummyImage }, ...options });
  };
  const renderPages = async (
    md: string,
    options?: PdfOptions,
  ): Promise<Buffer[]> => {
    const doc = await processor(options).process(md);
    const pages: Buffer[] = [];
    for await (const page of await pdfToImage(
      Buffer.from(doc.value as Uint8Array),
    )) {
      pages.push(page);
    }
    return pages;
  };

  it("article", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "article.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("lorem", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "lorem.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("lorem spacing", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "lorem.md"));
    const doc = await processor({ spacing: 1 }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("makurano", async () => {
    const font = await fs.readFile(
      path.join(fixturesDir, "fonts/ipaexg00401/ipaexg.ttf"),
    );
    const md = await fs.readFile(path.join(fixturesDir, "makurano.md"));
    const doc = await processor({
      fonts: [{ name: "ipa", normal: font }],
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("break", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "break.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("break with thematicBreak line", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "break.md"));
    const doc = await processor({ thematicBreak: "line" }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("footnotes", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "footnotes.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
    expect(await getPdfLinks(generated)).toMatchSnapshot();
  });

  it("right-to-left paragraphs by a mark", async () => {
    const doc = await processor().process("\u200fabc");
    const [item] = await getPdfTextItems(doc.value as Uint8Array);
    expect(item!.transform[4]).toBeGreaterThan(400);
  });

  it("list markers at the text of their first line", async () => {
    // an item starting with a table: its number sits with the text of the
    // cell, below its border and padding
    const doc = await processor().process("1. | a |\n   | - |");
    const items = await getPdfTextItems(doc.value as Uint8Array);
    const baselineOf = (str: string): number =>
      items.find((i) => i.str.startsWith(str))!.transform[5];
    expect(baselineOf("1.")).toBe(baselineOf("a"));
  });

  it("empty list items", async () => {
    // an item without text, its marker a bullet, is as tall as a line
    const baselineOfA = async (md: string): Promise<number> =>
      (
        await getPdfTextItems(
          (await processor().process(md)).value as Uint8Array,
        )
      ).find((i) => i.str.startsWith("a"))!.transform[5];
    expect(await baselineOfA("-\n- a")).toBe(await baselineOfA("- x\n- a"));
  });

  it("lists with tasks", async () => {
    // only the tasks' checkboxes are their markers
    const doc = await processor().process("- a\n- [ ] b");
    expect(
      (await getPdfMarkedContents(doc.value as Uint8Array)).filter(
        (tag) => tag === "Artifact",
      ),
    ).toHaveLength(1);
  });

  it("ordered task lists", async () => {
    // their checkboxes are their markers, so their numbers take no room
    expect(await renderPages("1000000. [ ] a")).toEqual(
      await renderPages("- [ ] a"),
    );
  });

  it("lists in a quote of a font not registered", async () => {
    // the font is inherited, the markers measured in it
    const md = "> 1000000. a\n> 1. b";
    const fonts: PdfOptions["fonts"] = ["Helvetica", "Courier"];
    expect(
      await renderPages(md, {
        fonts,
        styles: {
          default: { font: "Courier" },
          blockquote: { font: "Unknown" },
        },
      }),
    ).toEqual(
      await renderPages(md, {
        fonts,
        styles: { default: { font: "Courier" } },
      }),
    );
  });

  it("links to the heading of footnotes", async () => {
    // it is for screen readers and isn't printed, so links to it are text
    expect(await renderPages("[a](#footnote-label)[^1]\n\n[^1]: b")).toEqual(
      await renderPages("a[^1]\n\n[^1]: b"),
    );
  });

  it("heading", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "heading.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("paragraph", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "paragraph.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("decoration", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "decoration.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("link", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "link.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfLinks(generated)).toEqual([
      [
        "https://github.com/",
        "#header -> page 1, top 802",
        "https://example.com/",
      ],
    ]);
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("link heading", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "link-heading.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
    expect(await getPdfLinks(generated)).toMatchSnapshot();
  });

  it("outline", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "outline.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    expect(await getPdfOutline(generated)).toMatchSnapshot();
  });

  it("image", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "image.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("svg", async () => {
    const doc = await processor({
      image: {
        load: async () => {
          const img = await fs.readFile(
            path.join(fixturesDir, "images/tiger.svg"),
          );
          return img.buffer;
        },
      },
    }).process(`svg ![tiger](image.svg) test`);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("image load failure", async () => {
    const doc = await processor({
      image: {
        load: async () => {
          throw new Error("404");
        },
      },
    }).process(`a ![image](missing.png) b`);
    // the description of the image is kept
    expect(await getPdfText(doc.value as Uint8Array)).toBe("a image b");
  });

  it("image not enabled", async () => {
    // images are not loaded, keeping their descriptions
    const doc = await unified()
      .use(markdown)
      .use(pdf)
      .process(`a ![image](a.png) ![](b.png) b`);
    expect(await getPdfText(doc.value as Uint8Array)).toBe("a image b");
  });

  it("unreadable image", async () => {
    const doc = await processor({
      image: { load: async () => new Uint8Array([1, 2, 3]) },
    }).process("![a](a.png) b");
    expect(await getPdfText(doc.value as Uint8Array)).toBe("a b");
  });

  it("image loaded with file", async () => {
    const files: (string | undefined)[] = [];
    const doc = await processor({
      image: {
        // a view of a larger buffer, as Node.js Buffer may be
        load: async (_, file) => {
          files.push(file.path);
          const img = await fs.readFile(
            path.join(fixturesDir, "images/img.png"),
          );
          const pool = new Uint8Array(img.byteLength + 16);
          pool.set(img, 8);
          return pool.subarray(8, 8 + img.byteLength);
        },
      },
    }).process({ path: "/docs/input.md", value: "![a](a.png)" });
    expect(files).toEqual(["/docs/input.md"]);
    const pdf = Buffer.from(doc.value as Uint8Array).toString("latin1");
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(1);
  });

  it("image converted to png", async () => {
    // a 1x1 gif
    const gif = Uint8Array.from(
      atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="),
      (c) => c.charCodeAt(0),
    );
    const png = await fs.readFile(path.join(fixturesDir, "images/img.png"));
    const without = await processor({
      image: { load: async () => gif },
    }).process("![a](a.gif) b");
    expect(await getPdfText(without.value as Uint8Array)).toBe("a b");

    const converted: { width: number; height: number }[] = [];
    const doc = await processor({
      image: {
        load: async () => gif,
        toPng: async ({ width, height }) => {
          converted.push({ width, height });
          // Node.js Buffer as is
          return png;
        },
      },
    }).process("![a](a.gif) b");
    expect(converted).toEqual([{ width: 1, height: 1 }]);
    expect(await getPdfText(doc.value as Uint8Array)).toBe("b");
    const pdf = Buffer.from(doc.value as Uint8Array).toString("latin1");
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(1);
  });

  it("jpeg with exif orientation", async () => {
    // 40x20 px rotated by 90 degrees, shown as 20x40 px with the blue side up
    const doc = await processor({
      image: {
        load: () =>
          fs.readFile(path.join(fixturesDir, "images/orientation6.jpg")),
      },
    }).process("a ![rotated](rotated.jpg) b");
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("image cached across runs", async () => {
    const urls: string[] = [];
    const p = processor({
      image: {
        load: async (url) => {
          urls.push(url);
          return dummyImage();
        },
      },
    });
    await p.process({ path: "/a/input.md", value: "![a](a.png)" });
    await p.process({ path: "/a/input.md", value: "![a](a.png)" });
    // relative urls of other directories may be other images
    await p.process({ path: "/b/input.md", value: "![a](a.png)" });
    expect(urls).toEqual(["a.png", "a.png"]);
  });

  it("list-bullet", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-bullet.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("list-ordered", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-ordered.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("list-task", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-task.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("code", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "code.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("frontmatter", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "frontmatter.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("math", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "math.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("latex", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "latex.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("math with latexPlugin", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "math.md"));
    const doc = await processor({ plugins: [latexPlugin()] }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("math with latexPlugin spaced as paragraphs", async () => {
    const baselineOfAfter = async (spacing: number): Promise<number> =>
      (
        await getPdfTextItems(
          (
            await processor({ plugins: [latexPlugin()], spacing }).process(
              "$$\nx\n$$\n\nafter",
            )
          ).value as Uint8Array,
        )
      ).find((i) => i.str.startsWith("after"))!.transform[5];
    expect(
      (await baselineOfAfter(0)) - (await baselineOfAfter(20)),
    ).toBeCloseTo(20);
  });

  it("latex with latexPlugin", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "latex.md"));
    const doc = await processor({ plugins: [latexPlugin()] }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    // math is drawn as paths, not as text
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("plugins in their order", async () => {
    // each leaves the nodes it doesn't render to the next, and the last to
    // remark-pdf
    const doc = await processor({
      plugins: [
        async () => ({
          code: (node, ctx) =>
            node.lang === "a"
              ? {
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: ctx.render([{ type: "text", value: "first" }]),
                }
              : null,
        }),
        async () => ({
          code: (node, ctx) =>
            node.lang === "a" || node.lang === "b"
              ? {
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: ctx.render([{ type: "text", value: "second" }]),
                }
              : null,
        }),
      ],
    }).process("```a\nA\n```\n\n```b\nB\n```\n\n```c\nC\n```");
    expect(await getPdfText(doc.value as Uint8Array)).toBe("first\nsecond\nC");
  });

  it("images set by plugins", async () => {
    // drawn instead of loaded, at their size
    const doc = await processor({
      image: {
        load: async () => {
          throw new Error("404");
        },
      },
      plugins: [
        async ({ images }) => {
          images.set("a.svg", {
            type: "svg",
            data: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>',
            width: 200,
            height: 50,
          });
          return {};
        },
      ],
    }).process("a ![a](a.svg) b");
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("images set by plugins at urls html encodes", async () => {
    // keyed by the url of the markdown, which hast percent-encodes
    const doc = await processor({
      image: {
        load: async () => {
          throw new Error("404");
        },
      },
      plugins: [
        async ({ images }) => {
          images.set("図 1.svg", {
            type: "svg",
            data: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>',
            width: 200,
            height: 50,
          });
          return {};
        },
      ],
    }).process("a ![alt](<図 1.svg>) b");
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("tag", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "tag.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("text-emojis", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "text-emojis.md"));
    const doc = await processor({
      textStyle: [[/\p{Extended_Pictographic}/gu, { fontSize: 0 }]],
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("line layout", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "line-layout.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfLinks(generated)).toEqual([["https://example.com/"]]);
    expect(await getPdfText(generated)).toMatchSnapshot();
    // the text, also spaces at the end of lines, within the right margin of
    // the A4 page, the default margin
    expect(await getPdfTextRight(generated)).toBeLessThanOrEqual(595.28 - 40);
    // an image drawn many times is embedded once
    expect(
      Buffer.from(generated)
        .toString("latin1")
        .match(/\/Subtype \/Image/g),
    ).toHaveLength(1);
  });

  it("list layout", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-layout.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("table layout", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "table-layout.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("table row taller than a page", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "table-row.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("table header at a page break", async () => {
    const md = await fs.readFile(
      path.join(fixturesDir, "table-header-break.md"),
    );
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("heading pages", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "heading-pages.md"));
    const doc = await processor().process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(
      (await getPdfOutline(generated)).map((line) => line.split(" -> ")[0]),
    ).toEqual(Array.from({ length: 60 }, (_, i) => `h${i}`));
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("large font", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-fonts.md"));
    const doc = await processor({
      styles: { default: { fontSize: 40 } },
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("colors", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "colors.md"));
    const doc = await processor({
      textStyle: [
        [/a/g, { color: "rgba(255, 0, 0, 0.5)" }],
        [/b/g, { color: "hsl(120, 100%, 25%)" }],
        [/c/g, { color: "#0000ff80" }],
        [/d/g, { color: "transparent" }],
        [/e/g, { color: "#ff0000" }],
      ],
      styles: {
        default: { color: "#008000" },
        link: { color: "rgba(0, 0, 255, 0.3)" },
        inlineCode: { color: "currentColor" },
      },
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("font faces", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "font-faces.md"));
    const doc = await processor({
      fonts: [
        {
          name: '"a", b',
          normal: await fs.readFile(
            path.join(fixturesDir, "fonts/ipaexg00401/ipaexg.ttf"),
          ),
        },
      ],
      styles: { default: { font: '"a", b' } },
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("fonts not registered", async () => {
    const doc = await processor({
      fonts: ["Helvetica", "Courier"],
      styles: { default: { font: "Courier" }, head1: { font: "Unknown" } },
    }).process("# a\n\nb");
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("list markers in the font of the list", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-fonts.md"));
    const doc = await processor({
      fonts: ["Helvetica", "Courier"],
      styles: {
        default: { font: "Courier" },
        blockquote: { font: "Helvetica", fontSize: 24, bold: true },
      },
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("svg sizes", async () => {
    // drawn at the size of the layout, not at their width and height in px,
    // keeping their own preserveAspectRatio, and shrunk to a page
    const svgs: Record<string, string> = {
      "tall.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="2000"><rect width="200" height="2000" fill="red"/><rect width="100" height="100" fill="blue"/></svg>',
      "none.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="50" fill="blue"/></svg>',
      "page.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 2000"><rect width="50" height="2000" fill="red"/></svg>',
    };
    const doc = await processor({
      image: {
        load: async (url) => new TextEncoder().encode(svgs[url]).buffer,
      },
    }).process(
      "a ![tall](tall.svg) b\n\n![stretched](none.svg)\n\nc ![page](page.svg) d",
    );
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("decorations propagated, as CSS does", async () => {
    // an inner declaration adds to the outer ones, in the color of the text
    const doc = await processor({
      styles: { default: { underline: true }, link: { underline: false } },
      textStyle: [[/c/g, { color: "#ff0000", strike: true }]],
    }).process("a [b](https://example.com) c");
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("nested decorations", async () => {
    // both the link's underline and the strike
    const doc = await processor().process(
      "[~~a~~](https://example.com) ~~[b](https://example.com)~~",
    );
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("soft hyphens", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "soft-hyphens.md"));
    const doc = await processor({ size: "A7", margin: 5 }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
    // the hyphens the layout adds aren't text of the document
    expect(await getPdfMarkedContents(generated)).toContain("Artifact");
  });

  it("code styles", async () => {
    // inlineCode applies to code outside code blocks only
    const doc = await processor({
      styles: { inlineCode: { color: "#ff0000", bold: true, fontSize: 24 } },
    }).process("a `b` c\n\n```\nd\n```");
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("text styles", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "text-styles.md"));
    const doc = await processor({
      // each character takes every style matching it, later ones on top;
      // also of regexps not global or matching nothing, and only text of
      // the markdown, not the line breaks between elements
      textStyle: [
        [/b/, { color: "#ff0000" }],
        [/x*/g, { color: "#00ff00" }],
        [/abcd/g, { color: "#ff0000" }],
        [/bc/g, { bold: true }],
        [/cde/g, { color: "#0000ff" }],
        [/\s/g, { color: "red", fontSize: 16 }],
      ],
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("right to left", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "rtl.md"));
    const doc = await processor({
      fonts: [
        {
          name: "he",
          normal: await fs.readFile(
            path.join(
              fixturesDir,
              "fonts/NotoSansHebrew/NotoSansHebrew-Regular.ttf",
            ),
          ),
        },
        "Helvetica",
      ],
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
    // a link rectangle for each part of a link split by right to left text
    expect(await getPdfLinks(generated)).toMatchSnapshot();
  });

  it("list spacing", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-spacing.md"));
    const doc = await processor({ spacing: 20 }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("right to left lines that wrap", async () => {
    // every line from the right, also where its last space is dropped.
    // Words of three Hebrew letters, all different.
    const text = Array.from({ length: 40 }, (_, i) =>
      [i % 22, (i + 7) % 22, Math.floor(i / 22)]
        .map((k) => String.fromCodePoint(0x05d0 + k))
        .join(""),
    ).join(" ");
    const doc = await processor({
      fonts: [
        {
          name: "he",
          normal: await fs.readFile(
            path.join(
              fixturesDir,
              "fonts/NotoSansHebrew/NotoSansHebrew-Regular.ttf",
            ),
          ),
        },
      ],
    }).process(text);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
    // the words of each line from the right are the words of the text
    const items = (await getPdfTextItems(generated)).filter((i) =>
      i.str.trim(),
    );
    const ys = [...new Set(items.map((i) => Math.round(i.transform[5])))].sort(
      (a, b) => b - a,
    );
    expect(ys.length).toBeGreaterThan(1);
    const words = ys.flatMap((y) =>
      items
        .filter((i) => Math.round(i.transform[5]) === y)
        .sort((a, b) => b.transform[4] - a.transform[4])
        .map((i) => i.str.trim()),
    );
    expect(words.join(" ")).toEqual(text);
  });

  it("line mix", async () => {
    // lines of soft hyphens, characters outside the basic plane, images
    // and links across elements
    const md = await fs.readFile(path.join(fixturesDir, "line-mix.md"));
    const doc = await processor({
      size: "A7",
      margin: 10,
      fonts: [
        {
          name: "ipa",
          normal: await fs.readFile(
            path.join(fixturesDir, "fonts/ipaexg00401/ipaexg.ttf"),
          ),
        },
      ],
    }).process(md);
    const generated = doc.value as Uint8Array;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
    expect(await getPdfLinks(generated)).toMatchSnapshot();
  });
});
