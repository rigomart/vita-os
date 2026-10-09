import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@vita-os/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@vita-os/ui/components/field";
import { Input } from "@vita-os/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@vita-os/ui/components/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import {
  Archive,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Example, Group } from "./group";

export function OverlaysGroup() {
  const [responsiveOpen, setResponsiveOpen] = useState(false);

  return (
    <Group title="Overlays">
      <Example label="Dialog">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            New task
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
              <DialogDescription>
                Add a task to your Vita OS inbox.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="overlay-task-title">Title</FieldLabel>
              <Input
                id="overlay-task-title"
                placeholder="Draft the weekly review"
              />
            </Field>
            <DialogFooter showCloseButton>
              <Button>Create task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Example>

      <Example label="Responsive dialog">
        <Button variant="outline" onClick={() => setResponsiveOpen(true)}>
          View goal
        </Button>
        <ResponsiveDialog
          open={responsiveOpen}
          onOpenChange={setResponsiveOpen}
        >
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                Ship the design showcase
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Renders as a dialog on desktop and a drawer on mobile.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogFooter>
              <Button>Mark as done</Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </Example>

      <Example label="Sheet">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            Area settings
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Health Reset</SheetTitle>
              <SheetDescription>
                Configure how this area shows up across Vita OS.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button>Save changes</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Example>

      <Example label="Alert dialog">
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            <Trash2 />
            Delete area
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this area?</AlertDialogTitle>
              <AlertDialogDescription>
                Tasks and threads inside "Home Move" will be archived, not
                deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Example>

      <Example label="Popover">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            <Sparkles />
            Quick add
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Capture a thought</PopoverTitle>
              <PopoverDescription>
                It lands in your inbox for triage later.
              </PopoverDescription>
            </PopoverHeader>
            <Input placeholder="Renew passport" />
          </PopoverContent>
        </Popover>
      </Example>

      <Example label="Tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Archive" />
              }
            >
              <Archive />
            </TooltipTrigger>
            <TooltipContent>Archive thread</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Example>

      <Example label="Dropdown menu">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="Thread actions"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Thread actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Archive />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Example>
    </Group>
  );
}
