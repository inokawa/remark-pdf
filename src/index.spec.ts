import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { unified } from "unified";
import markdown from "remark-parse";
import gfm from "remark-gfm";
import footnotes from "remark-footnotes";
import frontmatter from "remark-frontmatter";
import math from "remark-math";
import pdf from "./node";
import { pdf as pdfToImage } from "pdf-to-img";
import { toMatchImageSnapshot } from "jest-image-snapshot";

import { advanceTo } from "jest-date-mock";
advanceTo(new Date(2018, 5, 27, 11, 30, 0));

const FIXTURE_PATH = "../fixtures";

expect.extend({ toMatchImageSnapshot });

describe("e2e", () => {
  const toPdfProcessor = unified()
    .use(markdown)
    .use(gfm)
    .use(footnotes)
    .use(frontmatter, ["yaml", "toml"])
    .use(math)
    .use(pdf, { output: "buffer", styles: {emoji: {fontSize: 0}} });

  const fixturesDir = path.join(__dirname, FIXTURE_PATH);
  const filenames = fs.readdirSync(fixturesDir);
  filenames.forEach((filename) => {
    it(filename, async () => {
      const doc = await toPdfProcessor.process(
        fs.readFileSync(path.join(fixturesDir, filename))
      );
      const generated = (await doc.result) as Buffer;
      for await (const page of await pdfToImage(generated)) {
        expect(page).toMatchImageSnapshot();
      }
    });
  });
});
