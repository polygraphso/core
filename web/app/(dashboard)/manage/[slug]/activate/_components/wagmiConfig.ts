/**
 * Wallet config for the activation flow, scoped to this route so connector JS
 * never rides along on the rest of the site. Base only — the payment lives there.
 */

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected(), coinbaseWallet({ appName: "polygraph.so" })],
  transports: { [base.id]: http() },
});
