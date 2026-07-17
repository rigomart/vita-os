import { SidebarTrigger } from "@vita-os/ui/components/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-12 items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
    </header>
  );
}
