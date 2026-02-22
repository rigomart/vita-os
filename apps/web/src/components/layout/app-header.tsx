import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-12 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
    </header>
  );
}
