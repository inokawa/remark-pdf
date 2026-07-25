import React, { useCallback, useState } from "react";
import EditorImpl from "react-simple-code-editor";
import debounce from "lodash.debounce";
import hljs from "highlight.js/lib/core";
import markdown from "highlight.js/lib/languages/markdown";
import "highlight.js/styles/github.css";
hljs.registerLanguage("markdown", markdown);

// react-simple-code-editor is CJS with `exports.default`. The Storybook
// production build (Vite 8 / Rolldown) applies Node's ESM -> CJS interop, so the
// default import is the module object instead of the component. Accept both.
const Editor = ((EditorImpl as unknown as { default?: typeof EditorImpl })
  .default ?? EditorImpl) as typeof EditorImpl;

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (text: string) => void;
  style?: Record<string, any>;
}

export default function MarkdownEditor({
  initialValue,
  onChange,
}: MarkdownEditorProps) {
  const [code, setCode] = useState(initialValue);
  const onChangeDebounced = useCallback(debounce(onChange, 2000), []);
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
      }}
    >
      <Editor
        value={code}
        onValueChange={(code) => {
          setCode(code);
          onChangeDebounced(code);
        }}
        highlight={(code) =>
          hljs.highlight(code, { language: "markdown" }).value
        }
        style={{
          fontFamily: '"Menlo", "Fira Code", monospace',
          fontSize: 12,
        }}
      />
    </div>
  );
}
