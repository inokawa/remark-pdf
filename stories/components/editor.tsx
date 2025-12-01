import React, { useCallback, useState } from 'react';
import Editor from 'react-simple-code-editor';
import debounce from "lodash.debounce";
import hljs from 'highlight.js/lib/core';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/github.css'
hljs.registerLanguage('markdown', markdown);

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (text: string) => void;
  style?: Record<string, any>
}

export default function MarkdownEditor({ initialValue, onChange, style = {} }: MarkdownEditorProps) {
  const [code, setCode] = useState(initialValue);
  const onChangeDebounced = useCallback(debounce(onChange, 2000), []);
  return (
    <Editor
      value={code}
      onValueChange={code => {
        setCode(code);
        onChangeDebounced(code);
      }}
      highlight={code => hljs.highlight(code, { language: 'markdown' }).value}
      style={{
        fontFamily: '"Menlo", "Fira Code", monospace',
        fontSize: 12,
        ...style
      }}
    />
  );
}