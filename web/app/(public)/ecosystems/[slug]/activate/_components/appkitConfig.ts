/**
 * Reown AppKit + wagmi adapter config for the activation flow, scoped to this
 * route (deliberately NOT in the root layout — the rest of the site never
 * ships wallet JS). No 'use client' here per the AppKit Next.js pattern; the
 * client provider (ActivateFlow) imports it and calls createAppKit at module
 * level. This ONE wagmi config backs both the pay step and the LI.FI swap
 * widget, so a wallet connected once works in both: the widget reuses this
 * config through LI.FI's external wallet management rather than running its own
 * (see SwapWidget).
 */

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  type AppKitNetwork,
} from "@reown/appkit/networks";

export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

/**
 * Base first (the payment chain, and the AppKit default). The other majors are
 * for the swap step, which shares this wagmi config: a client bridging from
 * mainnet/L2 holdings needs the source chain to be switchable.
 */
export const appkitNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  base,
  mainnet,
  arbitrum,
  optimism,
  polygon,
];

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
