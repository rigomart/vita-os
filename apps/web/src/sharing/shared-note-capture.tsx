import type { PropsWithChildren } from "react";

import { useCaptureNote } from "@vita-os/application";
import { Button } from "@vita-os/ui/components/button";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { useCallback, useEffect, useRef, useState } from "react";

import { pendingShareKey, readPendingShares } from "./pending-share";

/** Mounted only after authentication; the normal Note command owns the save. */
export function SharedNoteCapture({ children }: PropsWithChildren) {
  const [shares, setShares] = useState(readPendingShares);
  const body = shares[0];
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const { mutateAsync } = useCaptureNote();
  const feedback = useFeedback();

  const save = useCallback(async () => {
    if (!body) return;
    setFailed(false);
    try {
      await mutateAsync({ body });
    } catch {
      setFailed(true);
      return;
    }
    const remaining = readPendingShares().slice(1);
    if (remaining.length)
      sessionStorage.setItem(pendingShareKey, JSON.stringify(remaining));
    else sessionStorage.removeItem(pendingShareKey);
    started.current = false;
    setShares(remaining);
    feedback.success("Note added");
  }, [body, mutateAsync, feedback]);

  useEffect(() => {
    // React Strict Mode replays effects. Each share should still save once.
    if (started.current || !body) return;
    started.current = true;
    void save();
  }, [shares, body, save]);

  if (!body) return children;

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold">Shared note</h1>
      {failed ? (
        <>
          <p role="alert">
            Your note could not be saved. The shared text is kept here so you
            can retry.
          </p>
          <p className="whitespace-pre-wrap break-words">{body}</p>
          <Button onClick={() => void save()}>Retry</Button>
        </>
      ) : (
        <p role="status">Saving your note…</p>
      )}
    </main>
  );
}
