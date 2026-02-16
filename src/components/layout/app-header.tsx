import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { QuickAddTaskDialog } from "@/components/tasks/quick-add-task-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "q" && e.key !== "Q") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      setShowQuickAdd(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="flex h-12 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <div className="flex-1" />
      <Button
        size="sm"
        className="gap-1.5"
        onClick={() => setShowQuickAdd(true)}
      >
        <Plus className="h-4 w-4" />
        Add task
      </Button>
      <QuickAddTaskDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} />
    </header>
  );
}
