import { describe, it, expect } from "vitest";
import { layoutBlock, type BlockBox } from "./layout";
import type { BlockNode, TextNode } from "./mdast-util-to-pdf";

const text = (value: string): TextNode => ({
  type: "text",
  text: value,
  style: {
    fontSize: 10,
    font: "Helvetica",
    color: "black",
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  },
  attrs: {},
});

const cell = (value: string): BlockNode => ({
  type: "block",
  style: { display: "table-cell" },
  children: [text(value)],
});

const layout = (node: BlockNode) =>
  layoutBlock(node, 0, 0, {
    top: 0,
    width: 300,
    // every character is 10pt wide and every line is 10pt high
    textWidth: (str) => str.length * 10,
    textHeight: () => 10,
    resolveFont: (font) => font,
    resolveImageSize: () => null,
  });

describe("layoutBlock", () => {
  it("stretches every cell in a table row to the row height", () => {
    const table: BlockNode = {
      type: "block",
      style: { display: "table" },
      children: [
        {
          type: "block",
          style: { display: "table-row" },
          children: [
            // wraps onto multiple lines in a 100pt wide column
            cell("a long cell that wraps onto multiple lines"),
            cell("7"),
            cell("style"),
          ],
        },
        {
          type: "block",
          style: { display: "table-row" },
          children: [cell("short"), cell("3"), cell("style")],
        },
      ],
    };

    const box = layout(table);
    const rows = box.children as BlockBox[];
    expect(rows).toHaveLength(2);

    let y = 0;
    for (const row of rows) {
      expect(row.y).toBe(y);
      const cells = row.children as BlockBox[];
      expect(cells).toHaveLength(3);
      for (const c of cells) {
        expect(c.border).toBe(true);
        expect(c.y).toBe(row.y);
        expect(c.height).toBe(row.height);
      }
      y += row.height;
    }
    expect(rows[0]!.height).toBeGreaterThan(rows[1]!.height);
    expect(box.height).toBe(y);
  });
});
