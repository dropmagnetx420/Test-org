import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders admin-authored Markdown for the legal pages and the admin preview.
 * react-markdown does not render raw HTML and strips unsafe URL schemes by
 * default, so the admin-supplied string is safe to display without extra
 * sanitisation. Elements are mapped to the site's design tokens instead of
 * pulling in a typography plugin.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-[15px] leading-7 text-muted-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-8 text-2xl font-bold tracking-tight text-foreground first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-8 text-xl font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-lg font-semibold text-foreground first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="my-4 leading-7">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-6 marker:text-muted-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6 marker:text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-border pl-4 italic">{children}</blockquote>
          ),
          hr: () => <hr className="my-8 border-border/60" />,
          code: ({ children }) => (
            <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.85em]">
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
