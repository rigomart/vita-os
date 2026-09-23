import type { ApplicationClient } from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import {
  ApplicationClientProvider,
  ViewerProvider,
} from "@vita-os/application";

import { authClient } from "../lib/auth-client";

export function SignedInApplication({
  client,
  children,
}: PropsWithChildren<{ client: ApplicationClient }>) {
  const { data } = authClient.useSession();
  return (
    // Session changes replace the cache before children can read another account's data.
    <ApplicationClientProvider
      key={data?.user?.id ?? "signed-out"}
      client={client}
    >
      <ViewerProvider
        viewer={data?.user}
        signOut={() => void authClient.signOut()}
      >
        {children}
      </ViewerProvider>
    </ApplicationClientProvider>
  );
}
