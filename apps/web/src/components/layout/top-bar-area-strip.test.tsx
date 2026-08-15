import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea } from "@convex/lib/validators";
import type { ComponentProps } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { conditionDotClassName } from "@/features/areas/condition-presentation";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@/test/render-with-providers";

import { TopBarAreaStrip } from "./top-bar-area-strip";

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
let activeSlug: string | undefined;
const navigate = vi.fn();

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: () => areas,
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
  activeSlug = undefined;
  navigate.mockClear();
});

describe("TopBarAreaStrip rendering", () => {
  it("renders one link per Area in the user's own order", () => {
    render(<TopBarAreaStrip />);

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
    render(<TopBarAreaStrip />);

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
    render(<TopBarAreaStrip />);

    const links = screen.getAllByRole("link");

    for (let index = 0; index < 9; index += 1) {
      expect(links[index]).toHaveTextContent(String(index + 1));
    }
    expect(links[9]).toHaveTextContent(/^Area J$/);
  });

  it("shows a condition dot only for Areas that are not healthy", () => {
    areas = [
      makeArea(1),
      makeArea(2, { condition: "needs_attention" }),
      makeArea(3, { condition: "critical" }),
    ];
    render(<TopBarAreaStrip />);

    const links = screen.getAllByRole("link");

    expect(links[0]?.querySelector('[class*="bg-condition-"]')).toBeNull();
    expect(
      links[1]?.querySelector(`.${conditionDotClassName.needs_attention}`),
    ).toBeInTheDocument();
    expect(
      links[2]?.querySelector(`.${conditionDotClassName.critical}`),
    ).toBeInTheDocument();
  });

  it("renders nothing while the Areas are loading", () => {
    areas = undefined;
    const { container } = render(<TopBarAreaStrip />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no Areas", () => {
    areas = [];
    const { container } = render(<TopBarAreaStrip />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("TopBarAreaStrip shortcuts", () => {
  it("jumps to the Nth Area on a bare digit, shifted or not", () => {
    render(<TopBarAreaStrip />);

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
    render(<TopBarAreaStrip />);

    fireEvent.keyDown(document.body, { code: "Digit2", metaKey: true });
    fireEvent.keyDown(document.body, { code: "Digit2", ctrlKey: true });
    fireEvent.keyDown(document.body, { code: "Digit2", altKey: true });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("stays out of the way while typing in a field", () => {
    render(
      <>
        <input aria-label="Search" />
        <TopBarAreaStrip />
      </>,
    );

    const field = screen.getByRole("textbox", { name: "Search" });
    field.focus();
    fireEvent.keyDown(field, { code: "Digit2" });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores a digit with no Area behind it", () => {
    render(<TopBarAreaStrip />);

    fireEvent.keyDown(document.body, { code: "Digit9" });

    expect(navigate).not.toHaveBeenCalled();
  });
});
