import { it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { pdf as pdfToImage } from "pdf-to-img";

const rootDir = path.join(__dirname, "..");

// `--use remark-pdf` resolves to built `lib` of this package, so run `npm run build` before `npm run test:cli`.
it("cli", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "remark-pdf-"));
  try {
    const output = path.join(tmpDir, "output.pdf");
    await promisify(execFile)(
      process.execPath,
      [
        path.join(rootDir, "node_modules/remark-cli/cli.js"),
        path.join(rootDir, "fixtures/heading.md"),
        "--use",
        "remark-pdf",
        "--output",
        output,
      ],
      { cwd: rootDir },
    );

    // check that binary is written without corruption
    const data = await fs.readFile(output);
    expect(data.subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await pdfToImage(data);
    expect(pdf.length).toBeGreaterThan(0);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

it("cli with remark-embed-images", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "remark-pdf-"));
  try {
    const input = path.join(tmpDir, "input.md");
    const output = path.join(tmpDir, "output.pdf");
    await fs.copyFile(
      path.join(rootDir, "fixtures/images/img.png"),
      path.join(tmpDir, "img.png"),
    );
    await fs.writeFile(input, "![img](./img.png)\n");
    const { stderr } = await promisify(execFile)(
      process.execPath,
      [
        path.join(rootDir, "node_modules/remark-cli/cli.js"),
        input,
        "--use",
        "remark-embed-images",
        "--use",
        "remark-pdf=image:true",
        "--output",
        output,
      ],
      { cwd: rootDir },
    );
    expect(stderr).not.toContain("warning");

    const data = await fs.readFile(output);
    expect(data.toString("latin1").match(/\/Subtype \/Image/g)).toHaveLength(1);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
