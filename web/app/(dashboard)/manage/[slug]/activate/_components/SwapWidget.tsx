"use client";

/**
 * The "get $POLYGRAPH" step: LI.FI's swap widget pinned to $POLYGRAPH-on-Base as
 * the destination, so a member can pay in whatever they hold (any token, any
 * major chain) without leaving the page. Rendered inside the activation flow's
 * WagmiProvider so it shares the same wallet session as the stream step.
 */

import { LiFiWidget, type WidgetConfig } from "@lifi/widget";
import { EthereumProvider } from "@lifi/widget-provider-ethereum";
import { PAYMENT_CHAIN_ID, POLYGRAPH_TOKEN_ADDRESS } from "@/lib/paymentConfig";

const widgetConfig: WidgetConfig = {
  integrator: "polygraph.so",
  providers: [EthereumProvider()],
  toChain: PAYMENT_CHAIN_ID,
  toToken: POLYGRAPH_TOKEN_ADDRESS,
  disabledUI: { toToken: true },
  hiddenUI: { toAddress: true, appearance: true, language: true },
  appearance: "light",
  theme: {
    container: {
      border: "1px solid #d9d2c2",
      borderRadius: "4px",
    },
    colorSchemes: {
      light: {
        palette: {
          primary: { main: "#7a1f2b" },
          secondary: { main: "#5c5550" },
        },
      },
    },
    typography: {
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    },
  },
};

export function SwapWidget() {
  return <LiFiWidget integrator="polygraph.so" config={widgetConfig} />;
}
