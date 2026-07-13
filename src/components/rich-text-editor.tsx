"use client";

import { useRef, useState, useCallback } from "react";

interface RichTextEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}

export function RichTextEditor({
  name,
  defaultValue = "",
  placeholder = "Write something...",
  required = false,
  rows = 4,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      setHtml(editorRef.current.innerHTML);
    }
  }, []);

  const insertLink = useCallback(() => {
    const url = prompt("Enter link URL:", "https://");
    if (url) {
      exec("createLink", url);
    }
  }, [exec]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      setHtml(editorRef.current.innerHTML);
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const lineHeight = rows * 1.5;

  return (
    <div className="border border-outline-variant rounded overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-surface-container-low border-b border-outline-variant">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-lowest text-on-surface font-bold text-sm"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-lowest text-on-surface italic text-sm"
          title="Italic"
        >
          I
        </button>
        <span className="w-px h-5 bg-outline-variant mx-1" />
        <button
          type="button"
          onClick={insertLink}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-lowest text-on-surface text-sm"
          title="Insert Link"
        >
          🔗
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        dangerouslySetInnerHTML={{ __html: html || "" }}
        onInput={handleInput}
        onPaste={handlePaste}
        className="p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest outline-none min-h-[80px]"
        style={{ minHeight: `${lineHeight}em` }}
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
      />
      <input type="hidden" name={name} value={html} required={required} />
      {!html && (
        <style>{`
          div[contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: #9ca3af;
          }
        `}</style>
      )}
    </div>
  );
}
