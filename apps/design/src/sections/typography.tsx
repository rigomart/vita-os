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
      description="Raleway Variable drives headings (font-heading); Manrope Variable drives body text (font-sans). Both are variable fonts spanning weights 300 through 800."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <FamilySpecimen
          title="Raleway Variable — font-heading"
          fontClassName="font-heading"
          sample="Design system reference"
        />
        <FamilySpecimen
          title="Manrope Variable — font-sans"
          fontClassName="font-sans"
          sample="Design system reference"
        />
      </div>
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Paragraph sample
        </p>
        <p className="font-sans text-base leading-relaxed text-foreground">
          Vita OS pairs Raleway Variable for headings with Manrope Variable for
          body copy, keeping interface text legible at small sizes while giving
          section titles a distinct, editorial character.
        </p>
      </div>
    </Section>
  );
}
