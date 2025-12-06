import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { unified } from "unified";
import markdown from "remark-parse";
import gfm from "remark-gfm";
import frontmatter from "remark-frontmatter";
import pdf from "../src";
import MarkdownEditor from "./components/editor";
// @ts-expect-error no type definition
import text from "../fixtures/article.md?raw";
import { Preview } from "./components/preview";

export default {
  title: "Playground",
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div
    style={useMemo(
      () => ({
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        fontSize: "10.5pt",
      }),
      []
    )}
  >
    {children}
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div style={{ flex: 1, width: "48vh" }}>
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

export const MarkdownToPdf = () => {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<string | null>(null);
  const makePdf = useCallback((contents: string) => {
    startTransition(async () => {
      const toPdfProcessor = unified()
        .use(markdown)
        .use(gfm)
        .use(frontmatter)
        .use(pdf, {
          output: "blob",
          styles: {
            head1: {
              fontSize: 25,
            },
          },
        });
      const toPdf = async (s: string) => {
        const doc = await toPdfProcessor.process(s);
        return doc.result as Blob;
      };
      const blob = await toPdf(contents);

      setData(URL.createObjectURL(blob));
    });
  }, []);
  useEffect(() => {
    makePdf(text);
  }, []);
  return (
    <Wrapper>
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
    </Wrapper>
  );
};
