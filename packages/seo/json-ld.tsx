import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps {
  code: WithContext<Thing>;
}

const escapeJsonForHtml = (json: string): string =>
  json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

// Balise <script type="application/ld+json"> : le contenu est sérialisé en JSON puis
// échappé par escapeJsonForHtml ci-dessus.
// nosemgrep: project0-no-dangerous-html,typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
export const JsonLd = ({ code }: JsonLdProps) => (
  <script
    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD script with escaped content
    dangerouslySetInnerHTML={{
      // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      __html: escapeJsonForHtml(JSON.stringify(code)),
    }}
    type="application/ld+json"
  />
);

export * from "schema-dts";
