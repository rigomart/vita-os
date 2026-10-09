import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vita-os/ui/components/empty";
import { Kbd, KbdGroup } from "@vita-os/ui/components/kbd";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { Toaster } from "@vita-os/ui/components/sonner";
import { toast } from "@vita-os/ui/lib/toast";
import { Inbox } from "lucide-react";

import { Example, Group } from "./group";

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "destructive",
  "ghost",
] as const;

export function FeedbackGroup() {
  return (
    <Group title="Feedback & status">
      <Example label="Badge">
        {BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </Example>

      <Example label="Skeleton">
        <div className="flex w-64 flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Example>

      <Example label="Kbd">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>Enter</Kbd>
        </KbdGroup>
      </Example>

      <Example label="Toast">
        <Button
          variant="outline"
          onClick={() =>
            toast.success("Goal marked complete", {
              description: "Ship the Vita OS design showcase",
            })
          }
        >
          Complete goal
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error("Could not sync thread")}
        >
          Trigger error
        </Button>
        <Toaster />
      </Example>

      <Example label="Empty">
        <Empty className="w-full border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No open threads</EmptyTitle>
            <EmptyDescription>
              Threads you start will show up here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm">Start a thread</Button>
          </EmptyContent>
        </Empty>
      </Example>
    </Group>
  );
}
