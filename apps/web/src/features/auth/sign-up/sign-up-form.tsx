import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Label } from "@vita-os/ui/components/label";
import { type SubmitEvent, useState } from "react";
import { AuthCardShell } from "@/features/auth/auth-card-shell";

interface SignUpFormProps {
  error: string;
  loading: boolean;
  onSubmit: (value: { name: string; email: string; password: string }) => void;
  onGitHub: () => void;
}

export function SignUpForm({
  error,
  loading,
  onSubmit,
  onGitHub,
}: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    onSubmit({ name, email, password });
  };

  return (
    <AuthCardShell
      title="Sign Up"
      description="Create a new account to get started"
      onGitHub={onGitHub}
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/sign-in" className="text-primary underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </Button>
      </form>
    </AuthCardShell>
  );
}
