import type userEvent from "@testing-library/user-event";

import { screen } from "@testing-library/react";

/** Picks a day from the date picker's calendar, which is open beside its time and Repeat. */
export async function pickCalendarDay(
  user: ReturnType<typeof userEvent.setup>,
  day: RegExp,
) {
  await user.click(await screen.findByRole("button", { name: day }));
}
