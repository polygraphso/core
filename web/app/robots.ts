/**
 * robots.txt — allow crawling of the public site, point crawlers at the sitemap,
 * and keep them out of the operational routes (admin, the signed-in dashboard,
 * auth callbacks, the JSON API, and alert/monitor confirm pages). The private
 * sales decks (/base, /bankr, /ecosystems) are intentionally NOT listed here:
 * they carry their own page-level `noindex`, and naming them in a public
 * robots.txt would only advertise their existence.
 */
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

const ORIGIN = SITE_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /login and /fix are deliberately NOT disallowed: both carry a meta
      // noindex, and Google can only see a noindex on pages it may crawl.
      // Disallow+noindex together left them indexable as bare URLs.
      disallow: ["/admin", "/dashboard", "/auth", "/api/", "/notify", "/monitor"],
    },
    sitemap: `${ORIGIN}/sitemap.xml`,
    host: ORIGIN,
  };
}
