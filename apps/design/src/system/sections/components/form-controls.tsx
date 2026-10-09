import { Checkbox } from "@vita-os/ui/components/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@vita-os/ui/components/combobox";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@vita-os/ui/components/field";
import { Input } from "@vita-os/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@vita-os/ui/components/input-group";
import { Label } from "@vita-os/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { Textarea } from "@vita-os/ui/components/textarea";
import { Search } from "lucide-react";
import { useState } from "react";

import { Example, Group } from "./group";

const PROJECTS = ["Personal OS", "Health Reset", "Deep Work Q3", "Home Move"];

const HABITS = [
  { id: "morning-review", label: "Morning review" },
  { id: "deep-work-block", label: "Deep work block" },
  { id: "evening-shutdown", label: "Evening shutdown" },
];

export function FormControlsGroup() {
  const [priority, setPriority] = useState<string | null>("medium");
  const [project, setProject] = useState<string | null>(PROJECTS[0] ?? null);
  const [projectQuery, setProjectQuery] = useState(PROJECTS[0] ?? "");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);

  return (
    <Group title="Form controls">
      <Example label="Input">
        <Field className="max-w-xs">
          <FieldLabel htmlFor="task-title">Task title</FieldLabel>
          <Input id="task-title" placeholder="Write the Q3 retro" />
        </Field>
      </Example>

      <Example label="Input group">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search projects" />
        </InputGroup>
      </Example>

      <Example label="Textarea">
        <Field className="max-w-sm">
          <FieldLabel htmlFor="task-notes">Notes</FieldLabel>
          <Textarea id="task-notes" placeholder="Add context for future you…" />
          <FieldDescription>Visible only to you.</FieldDescription>
        </Field>
      </Example>

      <Example label="Checkbox">
        <div className="flex flex-col gap-2.5">
          {HABITS.map((habit) => (
            <Label key={habit.id} htmlFor={habit.id} className="gap-2.5">
              <Checkbox
                id={habit.id}
                defaultChecked={habit.id === "morning-review"}
              />
              {habit.label}
            </Label>
          ))}
        </div>
      </Example>

      <Example label="Select">
        <Field className="w-40">
          <FieldLabel htmlFor="priority-select">Priority</FieldLabel>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="priority-select" className="w-full">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Example>

      <Example label="Combobox">
        <Field className="w-52">
          <FieldLabel htmlFor="project-combobox">Project</FieldLabel>
          <Combobox<string>
            items={PROJECTS}
            value={project}
            onValueChange={setProject}
            inputValue={projectQuery}
            onInputValueChange={setProjectQuery}
          >
            <ComboboxInput
              id="project-combobox"
              placeholder="Choose a project"
            />
            <ComboboxContent>
              <ComboboxEmpty>No projects found</ComboboxEmpty>
              <ComboboxList>
                {(name: string) => (
                  <ComboboxItem key={name} value={name}>
                    {name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
      </Example>

      <Example label="Date picker">
        <Field className="w-fit">
          <FieldContent>
            <FieldLabel>Due date</FieldLabel>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="Set a due date"
            />
          </FieldContent>
        </Field>
      </Example>
    </Group>
  );
}
