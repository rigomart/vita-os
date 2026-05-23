import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";

import { toast } from "./toast";

export type Feedback = {
  success(message: string): void;
  error(message: string): void;
};

const defaultFeedback: Feedback = {
  success: (message) => toast.success(message),
  error: (message) => toast.error(message),
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
