import { Section } from "@/components/section";

import { ButtonsGroup } from "./components/buttons";
import { FeedbackGroup } from "./components/feedback";
import { FormControlsGroup } from "./components/form-controls";
import { OverlaysGroup } from "./components/overlays";
import { StructureGroup } from "./components/structure";

export function ComponentsSection() {
  return (
    <Section
      id="components"
      title="Components"
      description="A tour of the Vita OS component library, grouped by role — the building blocks used across tasks, threads, areas, and goals."
    >
      <div className="grid gap-6">
        <ButtonsGroup />
        <FormControlsGroup />
        <FeedbackGroup />
        <OverlaysGroup />
        <StructureGroup />
      </div>
    </Section>
  );
}
