/**
 * Reown AppKit + wagmi adapter config for every checkout on the site
 * (ecosystem activation today; any future pay step imports the same island).
 * Deliberately NOT in the root layout — pages that don't take payment never
 * ship wallet JS. No 'use client' here per the AppKit Next.js pattern;
 * WalletIsland imports it and calls createAppKit at module level. This is the
 * ONLY WagmiAdapter in the app: a second one anywhere would give users two
 * disjoint wallet sessions (the exact bug the shared tree removed). The LI.FI
 * swap widget reuses this config through its external wallet management rather
 * than running its own (see SwapWidget).
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

/**
 * Wallets verify this against the requesting origin via WalletConnect's Verify
 * API; it must match the origin the page is actually served from. That origin
 * is www.polygraph.so — the apex polygraph.so 307-redirects to www (Vercel
 * primary domain) — so a non-www url here reads as a domain mismatch and
 * wallets refuse or warn on connect.
 */
export const appkitMetadata = {
  name: "polygraph",
  description: "Independent behavioral grades for MCP servers and skills.",
  url: "https://www.polygraph.so",
  icons: ["https://www.polygraph.so/icon.svg"],
};
