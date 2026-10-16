import type { ApplicationClient } from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import {
  ApplicationClientProvider,
  ViewerProvider,
} from "@vita-os/application";

import { authClient } from "../lib/auth-client";
import { VersionReload } from "./version-reload";

export function SignedInApplication({
  client,
  downloadData,
  children,
}: PropsWithChildren<{
  client: ApplicationClient;
  downloadData?: () => Promise<void>;
}>) {
  const { data } = authClient.useSession();
  return (
    // Session changes replace the cache before children can read another account's data.
    <ApplicationClientProvider
      key={data?.user?.id ?? "signed-out"}
      client={client}
    >
      <VersionReload />
      <ViewerProvider
        viewer={data?.user}
        signOut={() => void authClient.signOut()}
        downloadData={downloadData}
      >
        {children}
      </ViewerProvider>
    </ApplicationClientProvider>
  );
}
