/**
 * The product's shell, for a host that composes it around pages of its own,
 * as the lab does around a prototype: `AppShell` with the product's chrome, or
 * `ShellBehavior` alone for a page that draws its own and reaches the shell's
 * actions with `useShellActions`.
 *
 * Its own entry, apart from the package index: the route tree loads the shell
 * by dynamic import, and a static re-export there would pull it back into the
 * entry bundle.
 */
export { AppShell } from "./layout/app-shell";
export {
  ShellBehavior,
  useShellActions,
  type ShellActions,
} from "./layout/shell-behavior";
