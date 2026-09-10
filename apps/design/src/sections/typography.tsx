import { Section } from "@/components/section";

const TYPE_SCALE = [
  "text-4xl",
  "text-3xl",
  "text-2xl",
  "text-xl",
  "text-lg",
  "text-base",
  "text-sm",
  "text-xs",
];

const WEIGHTS = [
  { className: "font-light", label: "300 Light" },
  { className: "font-normal", label: "400 Regular" },
  { className: "font-medium", label: "500 Medium" },
  { className: "font-semibold", label: "600 Semibold" },
  { className: "font-bold", label: "700 Bold" },
  { className: "font-extrabold", label: "800 Extrabold" },
];

function FamilySpecimen({
  title,
  fontClassName,
  sample,
}: {
  title: string;
  fontClassName: string;
  sample: string;
}) {
  return (
    <div className="space-y-8">
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Scale
        </p>
        <div className="divide-y">
          {TYPE_SCALE.map((className) => (
            <div key={className} className="flex items-baseline gap-4 py-2">
              <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">
                {className}
              </span>
              <span className={`${fontClassName} ${className} truncate`}>
                {sample}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Weight
        </p>
        <div className="divide-y">
          {WEIGHTS.map(({ className, label }) => (
            <div key={className} className="flex items-baseline gap-4 py-2">
              <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">
                {label}
              </span>
              <span className={`${fontClassName} ${className} text-xl`}>
                {sample}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      description="Inter Variable carries the whole interface. Headings (font-heading) and body text (font-sans) share the face and separate on weight and tracking instead; font-heading stays a seam for reintroducing a display face later."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <FamilySpecimen
          title="Inter Variable — font-heading"
          fontClassName="font-heading"
          sample="Design system reference"
        />
        <FamilySpecimen
          title="Inter Variable — font-sans"
          fontClassName="font-sans"
          sample="Design system reference"
        />
      </div>
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Paragraph sample
        </p>
        <p className="font-sans text-base leading-relaxed text-foreground">
          Vita OS runs on a single face, Inter Variable, with its cv05 and ss03
          alternates enabled so dense lists of times and counts stay legible at
          small sizes. Hierarchy comes from weight and tracking, not contrast
          between families.
        </p>
      </div>
    </Section>
  );
}
