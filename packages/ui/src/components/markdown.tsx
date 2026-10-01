import type { Nodes } from "mdast";

import { CheckIcon } from "lucide-react";
import { createContext, use } from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { cn } from "../lib/utils";
import { Checkbox } from "./checkbox";
import { Separator } from "./separator";

/** The task list item a checkbox belongs to: where it starts in the source. */
const TaskItemContext = createContext<{ offset?: number; label: string }>({
  label: "",
});

type HastElement = NonNullable<ExtraProps["node"]>;

function hastText(node: HastElement | HastElement["children"][number]): string {
  if (node.type === "text") return node.value;
  if (node.type !== "element") return "";
  return node.children.map(hastText).join("");
}

const taskMarker = /^((?:[-*+]|\d+[.)])[ \t]+)\[([ xX])\]/;

/**
 * Flip the task marker of the list item that starts at `offset`. Returns the
 * body unchanged when no task marker starts there.
 */
export function toggleMarkdownTask(body: string, offset: number): string {
  const match = taskMarker.exec(body.slice(offset));
  if (!match) return body;
  const at = offset + match[1]!.length + 1;
  const next = body[at] === " " ? "x" : " ";
  return body.slice(0, at) + next + body.slice(at + 1);
}

const linkClassName = "text-primary underline underline-offset-2 break-words";

function safeLink(url: string) {
  return /^(https?:|mailto:)/i.test(url) ? url : undefined;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-5 mb-2 font-heading text-[1.25em] leading-snug font-semibold first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 font-heading text-[1.125em] leading-snug font-semibold first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h6>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children, className }) => (
    <ul
      className={cn(
        "my-2 flex list-disc flex-col gap-1 pl-5",
        className?.includes("contains-task-list") && "list-none pl-0.5",
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol start={start} className="my-2 flex list-decimal flex-col gap-1 pl-5">
      {children}
    </ol>
  ),
  li: ({ children, className, node }) =>
    className?.includes("task-list-item") ? (
      <TaskItemContext
        value={{
          offset: node?.position?.start.offset,
          label: node ? hastText(node).trim() : "",
        }}
      >
        <li className="flex items-start gap-2.5 [&>p]:mb-1">{children}</li>
      </TaskItemContext>
    ) : (
      <li className="pl-0.5 [&>p]:mb-1">{children}</li>
    ),
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
  img: ({ alt }) => <span>{alt}</span>,
};

function TaskCheckbox({
  checked,
  onToggleTask,
}: {
  checked: boolean;
  onToggleTask?: (offset: number) => void;
}) {
  const { offset, label } = use(TaskItemContext);

  if (!onToggleTask || offset === undefined) {
    // A preview sits inside a card button, so it draws the box without a control.
    return (
      <span
        className={cn(
          "mt-1 flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-input/90",
          checked && "bg-primary text-primary-foreground",
        )}
      >
        {checked ? <CheckIcon aria-hidden className="size-3.5" /> : null}
        <span className="sr-only">{checked ? "Done: " : "To do: "}</span>
      </span>
    );
  }

  return (
    <Checkbox
      checked={checked}
      aria-label={label}
      onCheckedChange={() => onToggleTask(offset)}
      className="mt-1"
    />
  );
}

export function Markdown({
  children,
  variant = "read",
  className,
  onToggleTask,
}: {
  children: string;
  variant?: "read" | "preview";
  className?: string;
  /** Makes task list checkboxes interactive; receives the item's source offset. */
  onToggleTask?: (offset: number) => void;
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
          input: ({ checked }) => (
            <TaskCheckbox
              checked={checked === true}
              onToggleTask={variant === "read" ? onToggleTask : undefined}
            />
          ),
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
