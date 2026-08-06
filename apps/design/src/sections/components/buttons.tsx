import { Button } from "@vita-os/ui/components/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@vita-os/ui/components/button-group";
import { CalendarPlus, ChevronDown, Plus, Trash2 } from "lucide-react";

import { Example, Group } from "./group";

const VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;

const SIZES = ["sm", "default", "lg"] as const;

export function ButtonsGroup() {
  return (
    <Group title="Buttons">
      <Example label="Variants">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Example>

      <Example label="Sizes">
        {SIZES.map((size) => (
          <Button key={size} size={size}>
            New task
          </Button>
        ))}
        <Button size="icon" aria-label="Add task">
          <Plus />
        </Button>
      </Example>

      <Example label="With icon">
        <Button>
          <Plus />
          New goal
        </Button>
        <Button variant="secondary">
          <CalendarPlus />
          Schedule
        </Button>
        <Button variant="destructive">
          <Trash2 />
          Delete
        </Button>
      </Example>

      <Example label="Disabled">
        <Button disabled>Saving…</Button>
        <Button variant="outline" disabled>
          Archive
        </Button>
      </Example>

      <Example label="Button group">
        <ButtonGroup>
          <Button variant="outline">Day</Button>
          <Button variant="outline">Week</Button>
          <Button variant="outline">Month</Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="outline">
            <Plus />
            Add area
          </Button>
          <ButtonGroupSeparator />
          <Button variant="outline" size="icon" aria-label="More options">
            <ChevronDown />
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <ButtonGroupText>Filter</ButtonGroupText>
          <Button variant="outline">Active</Button>
          <Button variant="outline">Done</Button>
        </ButtonGroup>
      </Example>
    </Group>
  );
}
