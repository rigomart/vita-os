import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Markdown,
  markdownToPlainText,
  toggleMarkdownTask,
} from "@vita-os/ui/components/markdown";
import { describe, expect, it, vi } from "vitest";

describe("Markdown", () => {
  it("preserves single line breaks in existing Notes", () => {
    const { container } = render(
      <Markdown>{"Called the clinic\nWaiting for a reply"}</Markdown>,
    );
    expect(container.querySelector("p")?.innerHTML).toBe(
      "Called the clinic<br>\nWaiting for a reply",
    );
  });

  it("renders headings, nested lists and a GFM table", () => {
    render(
      <Markdown>
        {
          "# Consultation\n\n- Medication\n  - Follow up\n\n| Drug | Dose |\n| --- | --- |\n| Example | 10 mg |"
        }
      </Markdown>,
    );
    expect(
      screen.getByRole("heading", { name: "Consultation" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10 mg" })).toBeInTheDocument();
  });

  it("never creates raw HTML elements or loads Markdown images", () => {
    const { container } = render(
      <Markdown>
        {
          '<script>alert(1)</script>\n\n<iframe src="https://example.com"></iframe>\n\n![Results](https://example.com/image.png)'
        }
      </Markdown>,
    );
    expect(container.querySelector("script, iframe, img")).toBeNull();
    expect(screen.getByText("Results")).toBeInTheDocument();
  });

  it("only activates explicit http, https and mailto links in read mode", () => {
    render(
      <Markdown>
        {
          "[Web](https://example.com) [HTTP](http://example.com) [Email](mailto:clinic@example.com) [Unsafe](javascript:alert%281%29) [Relative](/private) [Protocol relative](//example.com)"
        }
      </Markdown>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Web" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "Web" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByText("Unsafe").closest("a")).toBeNull();
    expect(screen.getByText("Relative").closest("a")).toBeNull();
    expect(screen.getByText("Protocol relative").closest("a")).toBeNull();
  });

  it("renders preview links as inert text inside a card button", () => {
    render(
      <button type="button">
        <Markdown variant="preview">{"[Clinic](https://example.com)"}</Markdown>
      </button>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Clinic");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("draws tasks without controls unless they can be toggled", () => {
    render(
      <Markdown variant="preview">
        {"- [ ] Tests ordered\n- [x] Call completed"}
      </Markdown>,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
      "To do: Tests ordered",
    );
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent(
      "Done: Call completed",
    );
  });

  it("reports the source offset of a toggled task in read mode", async () => {
    const user = userEvent.setup();
    const body = "Before:\n\n- [ ] Tests ordered\n- [x] Call completed";
    const onToggleTask = vi.fn();
    render(<Markdown onToggleTask={onToggleTask}>{body}</Markdown>);
    expect(
      screen.getByRole("checkbox", { name: "Call completed" }),
    ).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Tests ordered" }));
    expect(onToggleTask).toHaveBeenCalledExactlyOnceWith(body.indexOf("- [ ]"));
  });

  it("keeps preview tasks inert even when a toggle is supplied", () => {
    render(
      <Markdown variant="preview" onToggleTask={vi.fn()}>
        {"- [ ] Tests ordered"}
      </Markdown>,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("toggleMarkdownTask", () => {
  it("flips the marker of the item at an offset and nothing else", () => {
    const body = "- [ ] One\n  1. [x] Two\n- Three";
    expect(toggleMarkdownTask(body, 0)).toBe(
      "- [x] One\n  1. [x] Two\n- Three",
    );
    expect(toggleMarkdownTask(body, body.indexOf("1."))).toBe(
      "- [ ] One\n  1. [ ] Two\n- Three",
    );
    expect(toggleMarkdownTask(body, body.indexOf("- Three"))).toBe(body);
  });

  it("toggles the offsets the renderer reports, inside quotes too", async () => {
    const user = userEvent.setup();
    let body = "> - [ ] Quoted task";
    render(
      <Markdown
        onToggleTask={(offset) => (body = toggleMarkdownTask(body, offset))}
      >
        {body}
      </Markdown>,
    );
    await user.click(screen.getByRole("checkbox", { name: "Quoted task" }));
    expect(body).toBe("> - [x] Quoted task");
  });
});

describe("markdownToPlainText", () => {
  it("keeps a leading heading and readable lines while stripping markup and URLs", () => {
    expect(
      markdownToPlainText(
        "# Consultation\n\n**Diagnosis**: _stable_\nCall [the clinic](https://example.com)\n\n- [ ] Blood test\n- `Follow up`",
      ),
    ).toBe(
      "Consultation\nDiagnosis: stable\nCall the clinic\n[ ] Blood test\nFollow up",
    );
  });

  it("uses Markdown parsing so escaped syntax, code and table values survive", () => {
    expect(
      markdownToPlainText(
        "\\*literal\\* and `a_b`\n\n| Drug | Dose |\n| --- | --- |\n| Example | 10 mg |\n\n![Result](https://example.com/image.png)\n\n<script>hidden</script>",
      ),
    ).toBe("*literal* and a_b\nDrug · Dose\nExample · 10 mg\nResult");
  });
});
