import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Label } from "@vita-os/ui/components/label";
import { type SubmitEvent, useState } from "react";

import {
  AuthCardShell,
  type SocialProviderOption,
} from "@/features/auth/auth-card-shell";

interface SignInFormProps {
  error: string;
  loading: boolean;
  providers: SocialProviderOption[];
  onSubmit: (value: { email: string; password: string }) => void;
}

export function SignInForm({
  error,
  loading,
  providers,
  onSubmit,
}: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    onSubmit({ email, password });
  };

  return (
    <AuthCardShell
      title="Sign In"
      description="Sign in to your account to continue"
      providers={providers}
      footer={
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/sign-up" className="text-primary underline">
            Sign up
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </AuthCardShell>
  );
}
