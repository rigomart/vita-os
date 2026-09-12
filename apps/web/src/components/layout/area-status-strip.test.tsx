import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type { ComponentProps } from "react";

import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { conditionPillClassName } from "@/features/areas/condition-presentation";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@/test/render-with-providers";

import { AreaStatusStrip } from "./area-status-strip";

function makeArea(
  index: number,
  overrides: Partial<ProjectedArea> = {},
): ProjectedArea {
  return {
    _id: `area${index}` as Id<"areas">,
    name: `Area ${index}`,
    slug: `area-${index}`,
    icon: "Compass",
    condition: "healthy",
    order: index,
    createdAt: index,
    ...overrides,
  };
}

let areas: ProjectedArea[] | undefined;
let threads: ProjectedThread[] | undefined;
let activeSlug: string | undefined;
const navigate = vi.fn();

// Two subscriptions now: the Areas, and the Threads behind their counts.
vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (query: unknown) =>
    getFunctionName(query as never) === "threads:list" ? threads : areas,
}));

// The strip only needs a clickable anchor and the Area route's params; the real
// router would demand a route tree this component never mounts under.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      to,
      params,
      ...props
    }: ComponentProps<"a"> & {
      to?: string;
      params?: { areaSlug?: string };
    }) => <a href={`/${params?.areaSlug ?? to}`} {...props} />,
    useMatch: () =>
      activeSlug === undefined
        ? undefined
        : { params: { areaSlug: activeSlug } },
    useNavigate: () => navigate,
  };
});

beforeEach(() => {
  areas = [makeArea(1), makeArea(2), makeArea(3)];
  threads = [];
  activeSlug = undefined;
  navigate.mockClear();
});

describe("AreaStatusStrip rendering", () => {
  it("renders one link per Area in the user's own order", () => {
    render(<AreaStatusStrip />);

    const links = within(
      screen.getByRole("navigation", { name: "Life Areas" }),
    ).getAllByRole("link");

    expect(links).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Area 1" })).toBe(links[0]);
    expect(screen.getByRole("link", { name: "Area 2" })).toBe(links[1]);
    expect(screen.getByRole("link", { name: "Area 3" })).toBe(links[2]);
  });

  it("marks only the routed Area as the current page", () => {
    activeSlug = "area-2";
    render(<AreaStatusStrip />);

    expect(screen.getByRole("link", { name: "Area 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Area 1" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Area 3" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows a shortcut digit for the first nine Areas only", () => {
    // Letter names keep the digit assertions honest: a numbered name would
    // satisfy them on its own.
    areas = Array.from({ length: 10 }, (_, index) =>
      makeArea(index + 1, { name: `Area ${String.fromCharCode(65 + index)}` }),
    );
    render(<AreaStatusStrip />);

    const links = screen.getAllByRole("link");

    for (let index = 0; index < 9; index += 1) {
      expect(links[index]).toHaveTextContent(String(index + 1));
    }
    expect(links[9]).toHaveTextContent(/^Area J$/);
  });

  it("colours the hexagon itself for Areas that are not healthy", () => {
    areas = [
      makeArea(1),
      makeArea(2, { condition: "needs_attention" }),
      makeArea(3, { condition: "critical" }),
    ];
    render(<AreaStatusStrip />);

    const links = screen.getAllByRole("link");

    expect(links[0]?.querySelector('[class*="bg-condition-"]')).toBeNull();
    expect(
      links[1]?.querySelector('[class*="bg-condition-attention-fill"]'),
    ).toBeInTheDocument();
    expect(
      links[2]?.querySelector('[class*="bg-condition-critical-fill"]'),
    ).toBeInTheDocument();
    expect(conditionPillClassName.critical).toContain(
      "bg-condition-critical-fill",
    );
  });

  it("counts each Area's open Threads and leaves an empty Area bare", () => {
    threads = [
      { _id: "t1", areaId: "area1", state: "open" },
      { _id: "t2", areaId: "area1", state: "open" },
      { _id: "t3", areaId: "area1", state: "resolved" },
      { _id: "t4", areaId: "area2", state: "open" },
    ] as unknown as ProjectedThread[];
    render(<AreaStatusStrip />);

    const links = screen.getAllByRole("link");

    expect(links[0]).toHaveTextContent("2");
    expect(links[0]).toHaveAccessibleName(/2 open/);
    expect(links[1]).toHaveTextContent("1");
    // No badge rather than a zero.
    expect(links[2]).toHaveAccessibleName("Area 3");
  });

  it("renders nothing while the Areas are loading", () => {
    areas = undefined;
    const { container } = render(<AreaStatusStrip />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no Areas", () => {
    areas = [];
    const { container } = render(<AreaStatusStrip />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("AreaStatusStrip shortcuts", () => {
  it("jumps to the Nth Area on a bare digit, shifted or not", () => {
    render(<AreaStatusStrip />);

    fireEvent.keyDown(document.body, { code: "Digit2" });

    expect(navigate).toHaveBeenCalledWith({
      to: "/$areaSlug",
      params: { areaSlug: "area-2" },
    });

    // Layouts like AZERTY type digits shifted; the physical key still counts.
    navigate.mockClear();
    fireEvent.keyDown(document.body, { code: "Digit2", shiftKey: true });

    expect(navigate).toHaveBeenCalledWith({
      to: "/$areaSlug",
      params: { areaSlug: "area-2" },
    });
  });

  it("leaves modifier chords to the browser", () => {
    render(<AreaStatusStrip />);

    fireEvent.keyDown(document.body, { code: "Digit2", metaKey: true });
    fireEvent.keyDown(document.body, { code: "Digit2", ctrlKey: true });
    fireEvent.keyDown(document.body, { code: "Digit2", altKey: true });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("stays out of the way while typing in a field", () => {
    render(
      <>
        <input aria-label="Search" />
        <AreaStatusStrip />
      </>,
    );

    const field = screen.getByRole("textbox", { name: "Search" });
    field.focus();
    fireEvent.keyDown(field, { code: "Digit2" });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores a digit with no Area behind it", () => {
    render(<AreaStatusStrip />);

    fireEvent.keyDown(document.body, { code: "Digit9" });

    expect(navigate).not.toHaveBeenCalled();
  });
});
