import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";

import { toast } from "./toast";

export type Feedback = {
  success(message: string): void;
  /**
   * A failure. `detail` carries text the person must not lose — a note that
   * was not saved, say — shown under the message and kept on screen until
   * dismissed, with an action such as Copy.
   */
  error(message: string, detail?: ErrorDetail): void;
  /**
   * Offer an Undo for an action that has already happened on screen. Resolves
   * `true` once the offer lapses and the action should be committed, or `false`
   * when the person undoes it. An optional second action commits at once,
   * then runs — Open thread, say, after adding a Note to one.
   */
  undoable(message: string, options?: UndoableOptions): Promise<boolean>;
};

export type ErrorDetail = {
  description: string;
  action?: { label: string; onClick: () => void };
};

export type UndoableOptions = {
  action?: { label: string; onClick: () => void };
};

const UNDO_WINDOW_MS = 5000;

const defaultFeedback: Feedback = {
  success: (message) => toast.success(message),
  error: (message, detail) =>
    detail === undefined
      ? toast.error(message)
      : toast.error(message, {
          description: detail.description,
          duration: Number.POSITIVE_INFINITY,
          closeButton: true,
          ...(detail.action === undefined ? {} : { action: detail.action }),
        }),
  undoable: (message, options) =>
    new Promise((resolve) => {
      let settled = false;
      const settle = (commit: boolean) => {
        if (settled) return;
        settled = true;
        resolve(commit);
      };
      const second = options?.action;
      toast(message, {
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: () => settle(false) },
        // Sonner's second button; it closes the toast without onDismiss.
        ...(second === undefined
          ? {}
          : {
              cancel: {
                label: second.label,
                onClick: () => {
                  settle(true);
                  second.onClick();
                },
              },
            }),
        onAutoClose: () => settle(true),
        onDismiss: () => settle(true),
      });
    }),
};

const FeedbackContext = createContext<Feedback | null>(null);

export function FeedbackProvider({
  children,
  feedback = defaultFeedback,
}: {
  children: ReactNode;
  feedback?: Feedback;
}) {
  return createElement(FeedbackContext.Provider, { value: feedback }, children);
}

export function useFeedback() {
  const feedback = useContext(FeedbackContext);
  if (!feedback) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return feedback;
}
