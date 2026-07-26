import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@vita-os/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@vita-os/ui/components/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@vita-os/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { describe, expect, it, vi } from "vitest";

describe("shared UI dependency smoke coverage", () => {
  it("opens a menu and invokes its selected action", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button />}>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onChoose}>Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));

    expect(onChoose).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(
      await screen.findByRole("menuitem", { name: "Archive" }),
    ).toBeVisible();
  });

  it("traps dialog focus, renders its close icon, and restores focus", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dependency check</DialogTitle>
          <DialogDescription>Dialog behavior remains intact.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Open dialog" });

    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Dependency check",
    });
    const close = screen.getByRole("button", { name: "Close" });
    expect(dialog).toContainElement(close);
    expect(close.querySelector(".lucide-x")).toBeInTheDocument();
    await waitFor(() => expect(close).toHaveFocus());

    await user.click(close);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens and closes a drawer", async () => {
    const user = userEvent.setup();

    render(
      <Drawer>
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Drawer check</DrawerTitle>
          <DrawerDescription>Drawer behavior remains intact.</DrawerDescription>
          <DrawerClose>Close drawer</DrawerClose>
        </DrawerContent>
      </Drawer>,
    );

    await user.click(screen.getByRole("button", { name: "Open drawer" }));

    expect(
      await screen.findByRole("dialog", { name: "Drawer check" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Close drawer" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAttribute(
        "data-state",
        "closed",
      ),
    );
  });

  it("opens a select and reports the chosen value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Select
        defaultValue="planned"
        onValueChange={onValueChange}
        items={[
          { label: "Planned", value: "planned" },
          { label: "Active", value: "active" },
        ]}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="planned">Planned</SelectItem>
          <SelectItem value="active">Active</SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Active" }));

    expect(onValueChange).toHaveBeenLastCalledWith("active", expect.anything());
  });
});
