/**
 * Reown AppKit + wagmi adapter config for the activation flow, scoped to this
 * route (deliberately NOT in the root layout — the rest of the site never
 * ships wallet JS). No 'use client' here per the AppKit Next.js pattern; the
 * client provider (ActivateFlow) imports it and calls createAppKit at module
 * level. Base only — the payment lives there.
 */

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base, type AppKitNetwork } from "@reown/appkit/networks";

export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

export const appkitNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [base];

export const wagmiAdapter = new WagmiAdapter({
  networks: appkitNetworks,
  projectId: reownProjectId,
  ssr: true, // required for Next.js App Router
});

/** Wallets verify this against the requesting origin; must match the domain. */
export const appkitMetadata = {
  name: "polygraph",
  description: "Independent behavioral grades for MCP servers and skills.",
  url: "https://polygraph.so",
  icons: ["https://polygraph.so/icon.svg"],
};
