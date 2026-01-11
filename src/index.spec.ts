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
import { toMatchImageSnapshot } from "jest-image-snapshot";
import * as pdfjsLib from "pdfjs-dist";

const FIXTURE_PATH = "../fixtures";
const fixturesDir = path.join(__dirname, FIXTURE_PATH);

expect.extend({ toMatchImageSnapshot });

const copyArrayBuffer = (buffer: ArrayBuffer) => {
  const newBuffer = new ArrayBuffer(buffer.byteLength);
  const uint8Array = new Uint8Array(newBuffer);
  uint8Array.set(new Uint8Array(buffer));
  return uint8Array;
};

const getPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  const pdfData = copyArrayBuffer(buffer);

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

  const img = await fs.readFile(path.join(fixturesDir, "img.png"));

  return img.buffer;
};

describe("e2e", () => {
  const processor = (options: PdfOptions = {}) => {
    return unified()
      .use(markdown)
      .use(gfm)
      .use(frontmatter, ["yaml", "toml"])
      .use(math)
      .use(pdf, { loadImage: dummyImage, ...options });
  };

  it("article", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "article.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("lorem", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "lorem.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("makurano", async () => {
    const font = await fs.readFile(path.join(fixturesDir, "fonts/ipaexg00401/ipaexg.ttf"));
    const md = await fs.readFile(path.join(fixturesDir, "makurano.md"));
    const doc = await processor({
      fonts: [{ name: "ipa", normal: font }],
    }).process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("break", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "break.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("footnotes", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "footnotes.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("heading", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "heading.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("paragraph", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "paragraph.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("decoration", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "decoration.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("link", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "link.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("image", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "image.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("list-bullet", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-bullet.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("list-ordered", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-ordered.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("list-task", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "list-task.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("code", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "code.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("frontmatter", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "frontmatter.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("math", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "math.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("latex", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "latex.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });

  it("tag", async () => {
    const md = await fs.readFile(path.join(fixturesDir, "tag.md"));
    const doc = await processor().process(md);
    const generated = await doc.result;
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
    const generated = await doc.result;
    for await (const page of await pdfToImage(Buffer.from(generated))) {
      expect(page).toMatchImageSnapshot();
    }
    expect(await getPdfText(generated)).toMatchSnapshot();
  });
});
