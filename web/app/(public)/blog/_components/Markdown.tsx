import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-5 text-ink-muted leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight mt-12 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-lg md:text-xl text-ink mt-8 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-ink-muted leading-relaxed">{children}</p>
          ),
          a: ({ href, children }) => {
            const external = !!href && /^https?:\/\//.test(href);
            return (
              <a
                href={href}
                className="text-ink underline decoration-rule underline-offset-2 hover:text-oxblood hover:decoration-oxblood transition-colors"
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
          strong: ({ children }) => (
            <strong className="text-ink font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 text-ink-muted">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 text-ink-muted">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-oxblood/40 pl-4 italic text-ink-muted">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[0.92em] text-ink bg-parchment-200/60 px-1 py-[1px] rounded-sm">
              {children}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
