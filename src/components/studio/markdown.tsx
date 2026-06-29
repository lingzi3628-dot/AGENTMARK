"use client";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        components={{
          code(props: any) {
            const { inline, className, children } = props;
            const text = String(children ?? "");
            const match = /language-(\w+)/.exec(className || "");
            if (inline) {
              return (
                <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  {text}
                </code>
              );
            }
            const lang = match?.[1] ?? "text";
            return <CodeBlock code={text.replace(/\n$/, "")} lang={lang} />;
          },
          img(props: any) {
            const { src, alt } = props;
            if (!src) return null;
            return (
               
              <img
                src={typeof src === "string" ? src : undefined}
                alt={alt ?? "generated image"}
                className="my-2 max-w-full rounded-lg border border-border"
              />
            );
          },
          p({ children }) {
            return <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>;
          },
          h1({ children }) { return <h3 className="mb-1 mt-2 text-base font-semibold first:mt-0">{children}</h3>; },
          h2({ children }) { return <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>; },
          h3({ children }) { return <h5 className="mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h5>; },
          a({ children, href }) {
            return <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{children}</a>;
          },
          blockquote({ children }) {
            return <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{children}</blockquote>;
          },
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto studio-scroll">
                <table className="w-full border-collapse text-xs">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-border px-2 py-1">{children}</td>;
          },
          hr() { return <hr className="my-3 border-border" />; },
          strong({ children }) { return <strong className="font-semibold">{children}</strong>; },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        customStyle={{ margin: 0, background: "transparent", fontSize: "12px", padding: "12px" }}
        codeTagProps={{ style: { fontFamily: "var(--font-geist-mono)" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
