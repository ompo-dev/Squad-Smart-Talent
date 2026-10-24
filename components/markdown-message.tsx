"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function MarkdownMessage({ content }: { content: string }) {
  return <div className="prose prose-sm max-w-none text-inherit prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-inherit prose-p:my-2 prose-p:leading-6 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-inherit prose-a:text-cyan-700 prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-slate-950 prose-pre:p-3 prose-pre:text-slate-100 prose-table:my-2 prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
}
