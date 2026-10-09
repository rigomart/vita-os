import type { Prototype } from "./prototype";

/**
 * Every prototype under `src/prototypes/`, by folder name. Kept apart from
 * `definePrototype`, which the prototypes import, so the two never form a
 * cycle that breaks hot reloading.
 */
const modules = import.meta.glob<{ default: Prototype }>(
  "../prototypes/*/index.tsx",
  { eager: true },
);

export const prototypes: { id: string; prototype: Prototype }[] =
  Object.entries(modules)
    .map(([path, module]) => ({
      id: path.split("/").at(-2)!,
      prototype: module.default,
    }))
    .sort((a, b) => a.prototype.title.localeCompare(b.prototype.title));

export function findPrototype(id: string) {
  return prototypes.find((entry) => entry.id === id);
}
