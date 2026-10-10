import type { ComponentType } from "react";

/** One direction a prototype tries. */
export interface Variant {
  /** Its address within the prototype, `?variant=<key>`. */
  key: string;
  name: string;
  /** What makes it different, in a sentence. */
  description?: string;
  component: ComponentType;
}

/**
 * One idea to try. A prototype is a folder under `src/prototypes/` whose
 * `index.tsx` default-exports one of these; the folder name is its address,
 * `/lab/<folder>`. It renders inside the lab's application, so it reads and
 * changes the scenario's data with the product's own hooks and components.
 *
 * Give it `variants` to compare directions: they are switched in place with
 * `[` and `]`, against the same data.
 */
export interface Prototype {
  title: string;
  /** What question it answers, in a sentence. */
  description: string;
  /**
   * Render inside the product's shell: its chrome, command palette and Thread
   * pane. For whole-screen directions; leave it off for parts of a screen.
   * `"without-chrome"` keeps the pane, the palette, the dialogs and the
   * shortcuts but draws no chrome, for a direction that draws its own; it
   * reaches the shell's actions with `useShellActions`.
   */
  shell?: boolean | "without-chrome";
  variants: readonly [Variant, ...Variant[]];
}

type PrototypeDefinition = Omit<Prototype, "variants"> &
  (
    | { component: ComponentType }
    | { variants: readonly [Variant, ...Variant[]] }
  );

/** A prototype with one direction can name just its component. */
export function definePrototype(definition: PrototypeDefinition): Prototype {
  if ("variants" in definition) return definition;
  const { component, ...prototype } = definition;
  return {
    ...prototype,
    variants: [{ key: "default", name: prototype.title, component }],
  };
}

/** The variant `key` names, or the first when it names none. */
export function findVariant(prototype: Prototype, key: string | undefined) {
  return (
    prototype.variants.find((variant) => variant.key === key) ??
    prototype.variants[0]
  );
}
