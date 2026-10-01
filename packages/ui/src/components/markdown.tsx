import type { Nodes } from "mdast";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { cn } from "../lib/utils";
import { Separator } from "./separator";

const linkClassName = "text-primary underline underline-offset-2 break-words";

function safeLink(url: string) {
  return /^(https?:|mailto:)/i.test(url) ? url : undefined;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-5 mb-2 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-3 mb-1 text-sm font-semibold first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-3 mb-1 text-sm font-semibold first:mt-0">{children}</h6>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 flex list-disc flex-col gap-1 pl-5">{children}</ul>
  ),
  ol: ({ children, start }) => (
    <ol start={start} className="my-2 flex list-decimal flex-col gap-1 pl-5">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 [&>p]:mb-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 max-w-full overflow-x-auto rounded-lg bg-muted p-3 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <Separator className="my-4" />,
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children, style }) => (
    <th
      style={style}
      className="border border-border bg-muted px-3 py-2 font-semibold"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border border-border px-3 py-2">
      {children}
    </td>
  ),
  input: ({ checked }) => <span>{checked ? "[x] " : "[ ] "}</span>,
  img: ({ alt }) => <span>{alt}</span>,
};

export function Markdown({
  children,
  variant = "read",
  className,
}: {
  children: string;
  variant?: "read" | "preview";
  className?: string;
}) {
  return (
    <div
      className={cn("min-w-0 break-words text-sm leading-relaxed", className)}
    >
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={safeLink}
        components={{
          ...components,
          a: ({ children: label, href }) =>
            variant === "read" && href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                {label}
              </a>
            ) : (
              <span className={linkClassName}>{label}</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

const markdownParser = unified().use(remarkParse).use(remarkGfm);

function plainText(node: Nodes): string {
  switch (node.type) {
    case "html":
    case "definition":
    case "footnoteDefinition":
    case "thematicBreak":
      return "";
    case "text":
    case "inlineCode":
    case "code":
      return node.value;
    case "image":
    case "imageReference":
      return node.alt ?? "";
    case "break":
      return "\n";
    case "root":
    case "list":
    case "blockquote":
    case "table":
      return node.children.map(plainText).filter(Boolean).join("\n");
    case "listItem": {
      const task =
        typeof node.checked === "boolean"
          ? node.checked
            ? "[x] "
            : "[ ] "
          : "";
      return task + node.children.map(plainText).filter(Boolean).join("\n");
    }
    case "tableRow":
      return node.children.map(plainText).join(" · ");
    default:
      return "children" in node ? node.children.map(plainText).join("") : "";
  }
}

export function markdownToPlainText(body: string): string {
  return plainText(markdownParser.parse(body))
    .replace(/\n{2,}/g, "\n")
    .trim();
}
