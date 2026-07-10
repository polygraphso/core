"use client";

/**
 * The "get $POLYGRAPH" step: LI.FI's swap widget pinned to $POLYGRAPH-on-Base as
 * the destination, so a member can pay in whatever they hold (any token, any
 * major chain) without leaving the page.
 *
 * External wallet management, per LI.FI's official Reown pattern: the widget
 * sits inside the SAME WagmiProvider as the pay step (AppKit's adapter config),
 * carries NO EthereumProvider of its own, and its connect buttons open the
 * AppKit modal via walletConfig.onConnect — one wallet connection powers both
 * the swap and the stream. (Passing EthereumProvider alongside an external
 * wagmi config runs two connector managers on one config; that fight was the
 * "connector.getProvider is not a function" crash.)
 *
 * Drawer variant on purpose: the widget hard-autofocuses its token-search input
 * on internal navigation, and in inline flow that focus scrolls the DOCUMENT
 * (observed live: click → page jumps to top). A MUI drawer is position-fixed,
 * so focus inside it can never move the page's scroll position.
 */

import { useEffect, useRef } from "react";
import { LiFiWidget, type WidgetConfig, type WidgetDrawer } from "@lifi/widget";
import { useAppKit } from "@reown/appkit/react";
import {
  PAYMENT_CHAIN_ID,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_SYMBOL,
} from "@/lib/paymentConfig";

// The widget focuses its drawer paper and (hardcoded autoFocus) its search
// inputs without { preventScroll }, and Chromium scrolls the DOCUMENT for
// focus() even on fixed-position elements — the page jumps on every internal
// navigation. Until LI.FI passes preventScroll, default it for focus calls
// inside the widget's drawer only. Scoped, idempotent, and a no-op everywhere
// else on the site.
declare global {
  interface Window {
    __lifiFocusPatched?: boolean;
  }
}
if (typeof window !== "undefined" && !window.__lifiFocusPatched) {
  window.__lifiFocusPatched = true;
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options?: FocusOptions) {
    if (this.closest?.(".MuiDrawer-root")) {
      return originalFocus.call(this, { preventScroll: true, ...options });
    }
    return originalFocus.call(this, options);
  };
}

const widgetConfig: WidgetConfig = {
  integrator: "polygraph.so",
  variant: "drawer",
  toChain: PAYMENT_CHAIN_ID,
  toToken: POLYGRAPH_TOKEN_ADDRESS,
  disabledUI: { toToken: true },
  hiddenUI: { toAddress: true, appearance: true, language: true },
  appearance: "light",
  theme: {
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
  const drawerRef = useRef<WidgetDrawer>(null);
  const { open } = useAppKit();
  const pin = useRef<{ y: number; sawOpen: boolean; timer: number; stop: () => void } | null>(null);

  // Belt over the braces above: even with preventScroll, Chromium natively
  // scrolls the document when the drawer's focus trap engages (observed live,
  // no JS scroll API involved). While the drawer is open the page behind is a
  // dimmed backdrop, so the correct behavior is simply: the document does not
  // move. Pin the scroll position from the opening click until the drawer is
  // gone, then restore and release.
  const armScrollPin = () => {
    pin.current?.stop();
    const state = { y: window.scrollY, sawOpen: false, timer: 0, stop: () => {} };
    const drawerOpen = () => {
      const root = document.querySelector(".MuiDrawer-root");
      return !!root && getComputedStyle(root).visibility !== "hidden";
    };
    const enforce = () => {
      if (drawerOpen()) {
        state.sawOpen = true;
        if (window.scrollY !== state.y) window.scrollTo(0, state.y);
      } else if (state.sawOpen) {
        if (window.scrollY !== state.y) window.scrollTo(0, state.y);
        state.stop();
      }
    };
    state.timer = window.setInterval(enforce, 100);
    const onScroll = () => enforce();
    window.addEventListener("scroll", onScroll, { passive: true });
    state.stop = () => {
      window.clearInterval(state.timer);
      window.removeEventListener("scroll", onScroll);
      if (pin.current === state) pin.current = null;
    };
    pin.current = state;
  };
  useEffect(() => () => pin.current?.stop(), []);

  return (
    <>
      <button
        onClick={() => {
          armScrollPin();
          drawerRef.current?.toggleDrawer();
        }}
        className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted border-b hairline border-dotted pb-0.5 hover:text-oxblood transition-colors"
      >
        + need {POLYGRAPH_TOKEN_SYMBOL}? swap any token
      </button>
      <LiFiWidget
        ref={drawerRef}
        integrator="polygraph.so"
        config={{
          ...widgetConfig,
          // The widget's connect buttons open the shared AppKit modal — one
          // wallet session for swap and stream alike.
          walletConfig: { onConnect: () => void open() },
        }}
      />
    </>
  );
}
