import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar } from "@vita-os/ui/components/calendar";
import { useState } from "react";
import { describe, expect, it } from "vitest";

const january = new Date(2026, 0, 1);
const januaryFifteenth = new Date(2026, 0, 15);

function SelectableCalendar() {
  const [selected, setSelected] = useState<Date>();

  return (
    <Calendar
      mode="single"
      month={january}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

describe("Calendar", () => {
  it("selects a date through the exported Calendar API", async () => {
    const user = userEvent.setup();

    render(<SelectableCalendar />);
    const day = screen.getByRole("button", {
      name: /Thursday, January 15th, 2026/,
    });

    await user.click(day);

    const selectedDay = screen.getByRole("button", {
      name: /Thursday, January 15th, 2026, selected/,
    });
    expect(selectedDay).toHaveAttribute("data-selected-single", "true");
  });

  it("moves keyboard focus between days", async () => {
    const user = userEvent.setup();

    render(
      <Calendar mode="single" month={january} selected={januaryFifteenth} />,
    );
    const selectedDay = screen.getByRole("button", {
      name: /Thursday, January 15th, 2026/,
    });
    const nextDay = screen.getByRole("button", {
      name: /Friday, January 16th, 2026/,
    });

    await user.click(selectedDay);
    expect(selectedDay).toHaveFocus();
    await user.keyboard("{ArrowRight}");

    await waitFor(() => expect(nextDay).toHaveFocus());
  });

  it("keeps Calendar styling hooks and navigation icons", () => {
    const { container } = render(
      <Calendar mode="single" month={january} selected={januaryFifteenth} />,
    );

    expect(container.querySelector('[data-slot="calendar"]')).toHaveClass(
      "group/calendar",
      "bg-surface-1",
    );
    expect(
      screen.getByRole("button", {
        name: /Thursday, January 15th, 2026/,
      }),
    ).toHaveClass("data-[selected-single=true]:bg-primary");
    expect(container.querySelectorAll(".lucide-chevron-left")).toHaveLength(1);
    expect(container.querySelectorAll(".lucide-chevron-right")).toHaveLength(1);
  });
});
