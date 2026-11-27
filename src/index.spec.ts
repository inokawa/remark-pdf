import { describe, it, expect } from "vitest";
import * as fs from "fs/promises";
import path from "path";
import { unified } from "unified";
import markdown from "remark-parse";
import gfm from "remark-gfm";
import frontmatter from "remark-frontmatter";
import math from "remark-math";
import pdf, { type PdfOptions } from "./plugin";
import { pdf as pdfToImage } from "pdf-to-img";
import {
  toMatchImageSnapshot,
  type MatchImageSnapshotOptions,
} from "jest-image-snapshot";
import * as pdfjsLib from "pdfjs-dist";

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

const loaded = new Map<string, ArrayBuffer>();
const dummyImage = async (url: string): Promise<ArrayBuffer> => {
  if (loaded.has(url)) {
    return loaded.get(url)!;
  }

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
    expect(await getPdfText(generated)).toMatchSnapshot();
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
          return dummyImage(url);
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
});
