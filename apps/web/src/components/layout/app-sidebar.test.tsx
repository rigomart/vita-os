import userEvent from "@testing-library/user-event";
import { SidebarProvider } from "@vita-os/ui/components/sidebar";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { AppSidebar } from "./app-sidebar";

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: () => 0,
}));

vi.mock("@/features/areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

vi.mock("@/features/sidebar/use-global-new-task-shortcut", () => ({
  useGlobalNewTaskShortcut: () => undefined,
}));

vi.mock("@/features/sidebar/use-sidebar-dialogs", () => ({
  useSidebarDialogs: () => ({
    showCreateThread: false,
    setShowCreateThread: vi.fn(),
    createForAreaId: undefined,
    showNewTask: false,
    setShowNewTask: vi.fn(),
    openNewTask: vi.fn(),
    showCreateArea: false,
    setShowCreateArea: vi.fn(),
    openCreateThread: vi.fn(),
  }),
}));

vi.mock("@/features/tasks/new-task/new-task-dialog", () => ({
  NewTaskDialog: () => null,
}));

vi.mock("@/features/tasks/use-create-task", () => ({
  useCreateTask: () => vi.fn(),
}));

vi.mock("@/features/threads/thread-form/create-thread-dialog", () => ({
  CreateThreadDialog: () => null,
}));

vi.mock("@/hooks/use-area-thread-tree", () => ({
  useAreaThreadTree: () => ({
    areas: [],
    areaThreads: new Map(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          name: "Jane Doe",
          email: "jane@example.com",
        },
      },
    }),
    signOut: vi.fn(),
  },
}));

describe("AppSidebar user menu", () => {
  it("opens without throwing and shows the account actions", async () => {
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Jane Doe/ }));

    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });
});
