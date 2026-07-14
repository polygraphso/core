/**
 * Server-rendered Schema.org JSON-LD. Render from server components only, so
 * the block is present in the initial HTML crawlers read (client-injected
 * structured data is invisible to most of them).
 */
export function JsonLd({ data }: { data: object }) {
  // Escaping every "<" as a unicode escape closes the script-breakout vector
  // (a literal "</script>" inside a string value); JSON parsers are unaffected.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
