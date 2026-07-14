"use client";

/**
 * The shared wallet island: ONE AppKit instance + ONE wagmi tree for every
 * checkout on the site. Wrap a pay flow's client component in this and use
 * wagmi/AppKit hooks inside; wallet JS stays off every route that doesn't
 * render it. createAppKit runs once at module level per the AppKit pattern.
 * No reconnectOnMount: a payment page shouldn't poke wallet extensions on
 * load.
 */

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider } from "wagmi";
import { appkitMetadata, appkitNetworks, reownProjectId, wagmiAdapter } from "./appkitConfig";

// Module level per the AppKit pattern — runs once on import, never per render.
if (reownProjectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: appkitNetworks,
    projectId: reownProjectId,
    metadata: appkitMetadata,
    features: { analytics: false, email: false, socials: false },
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#7a1f2b",
      "--w3m-font-family": "'IBM Plex Sans', system-ui, sans-serif",
    },
  });
}

const queryClient = new QueryClient();

export function WalletIsland({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
