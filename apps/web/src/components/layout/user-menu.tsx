import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { LogOut, Monitor, Moon, Palette, Sun } from "lucide-react";

import type { ThemePreference } from "@/features/theme/theme-provider";

interface UserMenuUser {
  name?: string | null;
  email?: string | null;
}

interface UserMenuProps {
  onThemeChange: (theme: ThemePreference) => void;
  user?: UserMenuUser | null;
  onSignOut: () => void;
  theme: ThemePreference;
}

const themeOptions = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] satisfies readonly {
  value: ThemePreference;
  label: string;
  icon: typeof Monitor;
}[];

export function UserMenu({
  user,
  theme,
  onThemeChange,
  onSignOut,
}: UserMenuProps) {
  const accountName = user?.name ?? user?.email ?? "Account";
  const initial = (user?.name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={accountName}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        }
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              {user?.name && (
                <p className="text-sm leading-none font-medium">{user.name}</p>
              )}
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette />
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) =>
                  onThemeChange(value as ThemePreference)
                }
              >
                {themeOptions.map(({ value, label, icon: ThemeIcon }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <ThemeIcon />
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
