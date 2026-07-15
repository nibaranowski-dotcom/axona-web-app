import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";

// UX.12 — render an assistant answer's markdown body (bold/italic, headings,
// bullet + numbered lists, rules, inline code + code blocks, links, and GFM
// pipe TABLES) into SANITIZED output. The model's text is untrusted: react-markdown
// never parses embedded HTML (no raw-HTML plugin is enabled) and rehype-sanitize
// strips anything unsafe, so there is no HTML injection. Styled with v2 tokens —
// JetBrains Mono for code + tables, ink/paper/panel surfaces, hairlines, one lime
// accent, no emoji, no invented reds. Partial markdown mid-stream (an unclosed **
// or half a table) renders progressively without throwing.

// Every block sits inside the chat bubble; wide code/tables scroll WITHIN the
// message (UX.10 containment) via an overflow-x-auto wrapper — never the page.
const components: Components = {
  p: ({ children }) => (
    <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-ink-muted">{children}</del>,
  h1: ({ children }) => (
    <h1 className="mb-1 mt-3 text-[15px] font-semibold text-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1 mt-3 text-[14px] font-semibold text-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-0.5 pl-[18px] marker:text-ink-faint">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-[18px] marker:text-ink-muted">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.5]">{children}</li>,
  hr: () => <hr className="my-3 border-0 border-t border-line" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ink underline decoration-line-strong underline-offset-2 hover:text-accent hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-line-strong pl-3 text-ink-muted">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    // inline code (no language class, no newline) vs a fenced block
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className="font-mono text-[12px] text-ink" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-[4px] border border-line bg-paper px-1 py-0.5 font-mono text-[12px] text-ink"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-[8px] border border-line bg-paper p-2.5">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-[8px] border border-line">
      <table className="w-full border-collapse font-mono text-[12px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-paper">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-line-strong px-2 py-1 text-left font-semibold text-ink">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-line px-2 py-1 align-top text-ink">
      {children}
    </td>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[13px] leading-[1.5] text-ink [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
