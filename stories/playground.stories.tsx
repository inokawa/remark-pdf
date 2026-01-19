import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { StoryObj } from "@storybook/react-vite";
import { unified } from "unified";
import markdown from "remark-parse";
import gfm from "remark-gfm";
import frontmatter from "remark-frontmatter";
import { saveAs } from "file-saver";
import pdf from "remark-pdf";
import MarkdownEditor from "./components/editor";
// @ts-expect-error no type definition
import readmeMd from "../README.md?raw";
import { Preview } from "./components/preview";

export default {
  title: "Playground",
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div
    style={{ flex: 1, width: "48vh", display: "flex", flexDirection: "column" }}
  >
    <h3
      style={{
        fontFamily: "Nunito Sans, -apple-system, sans-serif",
        margin: 0,
        padding: "2px 5px",
        textAlign: "center",
        border: "3px solid #ffffff",
        backgroundColor: "rgb(246, 249, 252)",
      }}
    >
      {title}
    </h3>
    {children}
  </div>
);

const toPdfProcessor = unified()
  .use(markdown)
  .use(gfm)
  .use(frontmatter)
  .use(pdf, {
    spacing: 4,
    styles: {
      head1: {
        fontSize: 24,
      },
    },
  });

const Component = ({ text }: { text: string }) => {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<Blob | null>(null);
  const makePdf = useCallback((contents: string) => {
    startTransition(async () => {
      const res = await toPdfProcessor.process(contents);
      setData(new Blob([await res.result], { type: "application/pdf" }));
    });
  }, []);
  useEffect(() => {
    makePdf(text);
  }, []);
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        fontSize: "10.5pt",
      }}
    >
      <div style={{ position: "absolute", right: 0, top: 0 }}>
        <button
          disabled={!data}
          onClick={() => {
            if (data) {
              saveAs(data, "example.pdf");
            }
          }}
        >
          download
        </button>
      </div>
      <Section title="Edit markdown here">
        <MarkdownEditor initialValue={text} onChange={makePdf} />
      </Section>
      <Section title="Live PDF preview">
        {pending || !data ? (
          <div style={{ textAlign: "center" }}>rendering...</div>
        ) : (
          <Preview data={data} />
        )}
      </Section>
    </div>
  );
};

export const Readme: StoryObj = {
  render: () => <Component text={readmeMd} />,
};
