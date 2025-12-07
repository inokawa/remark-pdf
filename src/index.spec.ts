import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { unified } from "unified";
import markdown from "remark-parse";
import gfm from "remark-gfm";
import footnotes from "remark-footnotes";
import frontmatter from "remark-frontmatter";
import math from "remark-math";
import pdf, { PdfOptions } from "./node";
import { pdf as pdfToImage } from "pdf-to-img";
import { toMatchImageSnapshot } from "jest-image-snapshot";

const FIXTURE_PATH = "../fixtures";

expect.extend({ toMatchImageSnapshot });

describe("e2e", () => {
  const processor = (options: Omit<PdfOptions, "outupt"> = {}) => {
    return unified()
      .use(markdown)
      .use(gfm)
      .use(footnotes)
      .use(frontmatter, ["yaml", "toml"])
      .use(math)
      .use(pdf, { ...options, output: "buffer" });
  };

  const fixturesDir = path.join(__dirname, FIXTURE_PATH);

  it("article", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "article.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("lorem", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "lorem.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("makurano", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "makurano.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("break", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "break.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("code", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "code.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("footnotes", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "footnotes.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("footnotes2", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "footnotes2.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("frontmatter-toml", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "frontmatter-toml.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("frontmatter-yaml", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "frontmatter-yaml.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("heading", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "heading.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("image-reference", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "image-reference.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("link-reference", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "link-reference.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("list-numbering-restart", async () => {
    const md = fs.readFileSync(
      path.join(fixturesDir, "list-numbering-restart.md")
    );
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("math", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "math.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("ml", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "ml.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("paragraph", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "paragraph.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("phrasing-1", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "phrasing-1.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("phrasing-2", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "phrasing-2.md"));
    const doc = await processor().process(md);
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });

  it("text-emojis", async () => {
    const md = fs.readFileSync(path.join(fixturesDir, "text-emojis.md"));
    const doc = await processor({ styles: { emoji: { fontSize: 0 } } }).process(
      md
    );
    const generated = (await doc.result) as Buffer;
    for await (const page of await pdfToImage(generated)) {
      expect(page).toMatchImageSnapshot();
    }
  });
});
