/**
 * Fetches NPR CDS documentation and writes formatted summaries to docs/raw/.
 *
 * Two artifacts are produced:
 *   - docs/raw/npr-cds-api.md       — narrative pages (getting started,
 *                                     core concepts, endpoints) scraped from
 *                                     https://npr.github.io/content-distribution-service/
 *   - docs/raw/npr-cds-profiles.md  — per-profile property reference rendered
 *                                     from the raw JSON schemas served by
 *                                     https://content.api.npr.org/v1/profiles/<name>
 *
 * Usage: npm run update-docs
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_SITE = "https://npr.github.io/content-distribution-service";
const SCHEMA_BASE = "https://content.api.npr.org/v1/profiles";
const PROFILES_INDEX = `${DOCS_SITE}/api-reference/profiles/`;
const DOCS_DIR = join(__dirname, "../docs/raw");
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- HTML fetch / extract helpers --------------------------------------

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json() as Promise<T>;
}

/** Extract the <main>…</main> region from a Just-the-Docs HTML page. */
function extractMain(html: string): string {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return match ? match[1] : html;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Minimal HTML → Markdown converter tuned for Just-the-Docs pages.
 * Handles: headings, paragraphs, lists, tables, code blocks, inline code,
 * links, strong/em. Everything else is stripped.
 */
function htmlToMarkdown(html: string): string {
  let s = html;

  // Drop structural/decorative elements whole.
  s = s.replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
  s = s.replace(/<button\b[\s\S]*?<\/button>/gi, "");
  s = s.replace(/<nav\b[\s\S]*?<\/nav>/gi, "");
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  // Drop the in-page table-of-contents anchor icons.
  s = s.replace(/<a [^>]*class="anchor-heading"[^>]*>[\s\S]*?<\/a>/gi, "");

  // Code blocks — Just-the-Docs uses Rouge: <div class="language-*"><div class="highlight"><pre><code>…</code></pre>
  s = s.replace(
    /<div class="language-([\w-]+)[^"]*"[\s\S]*?<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>[\s\S]*?<\/div>\s*<\/div>/gi,
    (_m, lang: string, code: string) => {
      const text = decodeEntities(stripTags(code)).replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    }
  );
  s = s.replace(
    /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_m, code: string) => {
      const text = decodeEntities(stripTags(code)).replace(/\n+$/, "");
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    }
  );

  // Tables
  s = s.replace(/<div class="table-wrapper">([\s\S]*?)<\/div>/gi, "$1");
  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner: string) =>
    convertTable(inner)
  );

  // Headings
  s = s.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_m, level: string, inner: string) => {
      const text = decodeEntities(stripTags(inner)).trim();
      return `\n\n${"#".repeat(Number(level))} ${text}\n\n`;
    }
  );

  // Lists (handle a single level — nested lists get flattened, which is fine for our use).
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) =>
    convertList(inner, "-")
  );
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) =>
    convertList(inner, "1.")
  );

  // Inline formatting
  s = s.replace(
    /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const text = decodeEntities(stripTags(inner)).trim();
      const url = href.startsWith("/")
        ? `${DOCS_SITE}${href.replace(/^\/content-distribution-service/, "")}`
        : href;
      return `[${text}](${url})`;
    }
  );
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  s = s.replace(
    /<code[^>]*>([\s\S]*?)<\/code>/gi,
    (_m, inner: string) => `\`${decodeEntities(stripTags(inner))}\``
  );
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Paragraphs
  s = s.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (_m, inner: string) => `\n\n${decodeEntities(inner).trim()}\n\n`
  );

  // Strip any remaining tags
  s = stripTags(s);
  s = decodeEntities(s);

  // Collapse whitespace
  s = s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
  return s.trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function convertList(inner: string, bullet: string): string {
  const items: string[] = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const text = decodeEntities(stripTags(m[1])).replace(/\s+/g, " ").trim();
    if (text) items.push(`${bullet} ${text}`);
  }
  return `\n\n${items.join("\n")}\n\n`;
}

function convertTable(inner: string): string {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(inner)) !== null) {
    const cells: string[] = [];
    const cellRe = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      cells.push(decodeEntities(stripTags(cm[2])).replace(/\s+/g, " ").trim());
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return "";
  const header = rows[0];
  const body = rows.slice(1);
  const sep = header.map(() => "---");
  const fmt = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return `\n\n${fmt(header)}\n${fmt(sep)}\n${body.map(fmt).join("\n")}\n\n`;
}

// ---------- JSON Schema rendering --------------------------------------------

interface JsonSchema {
  $id?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  minLength?: number;
  minItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JsonSchema;
}

/** Short, human-readable rendering of a schema's type. */
function describeType(schema: JsonSchema): string {
  if (schema.$ref) return refName(schema.$ref);
  if (schema.enum) {
    const vals = schema.enum.map(v =>
      typeof v === "string" ? `"${v}"` : String(v)
    );
    return vals.length <= 6
      ? `enum(${vals.join(" | ")})`
      : `enum(${vals.length} values)`;
  }
  if (schema.const !== undefined)
    return `const(${JSON.stringify(schema.const)})`;
  if (schema.allOf)
    return (
      schema.allOf.map(describeType).filter(Boolean).join(" & ") || "object"
    );
  if (schema.oneOf)
    return schema.oneOf.map(describeType).filter(Boolean).join(" | ");
  if (schema.anyOf)
    return schema.anyOf.map(describeType).filter(Boolean).join(" | ");
  const t = Array.isArray(schema.type) ? schema.type.join("|") : schema.type;
  if (t === "array" && schema.items)
    return `array<${describeType(schema.items)}>`;
  if (t === "string" && schema.format) return `string(${schema.format})`;
  return t ?? "any";
}

function refName(ref: string): string {
  return ref.replace(/^.*\//, "");
}

/** Render a profile schema to a markdown section. */
function renderProfile(name: string, schema: JsonSchema): string {
  const lines: string[] = [];
  const title = schema.title ?? name;
  lines.push(`### \`${name}\` — ${title}`);
  lines.push("");
  lines.push(
    `> Schema: [\`/v1/profiles/${name}\`](${SCHEMA_BASE}/${name}) · Docs: [${name}](${DOCS_SITE}/api-reference/profiles/${name}.html)`
  );
  lines.push("");
  if (schema.description) {
    lines.push(schema.description.trim());
    lines.push("");
  }

  // Inheritance — top-level allOf $refs are how profiles compose.
  if (schema.allOf?.length) {
    const refs = schema.allOf
      .filter(s => s.$ref)
      .map(s => `\`${refName(s.$ref!)}\``);
    if (refs.length) {
      lines.push(`**Extends:** ${refs.join(", ")}`);
      lines.push("");
    }
  }

  const required = new Set(schema.required ?? []);
  const props = schema.properties;
  if (props && Object.keys(props).length) {
    lines.push("| Property | Type | Required | Description |");
    lines.push("|----------|------|----------|-------------|");
    for (const [key, val] of Object.entries(props)) {
      const type = describeType(val).replace(/\|/g, "\\|");
      const req = required.has(key) ? "✓" : "";
      const desc = (val.description ?? "")
        .replace(/\s+/g, " ")
        .replace(/\|/g, "\\|")
        .slice(0, 240)
        .trim();
      lines.push(`| \`${key}\` | ${type} | ${req} | ${desc} |`);
    }
    lines.push("");
  } else if (!schema.allOf) {
    lines.push("_No properties defined — see raw schema._");
    lines.push("");
  }

  return lines.join("\n");
}

// ---------- Profile list extraction ------------------------------------------

async function getProfileNames(): Promise<string[]> {
  const html = await fetchText(PROFILES_INDEX);
  const names = new Set<string>();
  const re =
    /href="\/content-distribution-service\/api-reference\/profiles\/([a-z0-9-]+)\.html"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) names.add(m[1]);
  return [...names].sort();
}

// ---------- Output: profiles --------------------------------------------------

async function updateProfilesDoc() {
  console.log("Fetching CDS profile list…");
  const names = await getProfileNames();
  console.log(`  Found ${names.length} profiles. Fetching raw schemas…`);

  const results = await Promise.all(
    names.map(async name => {
      try {
        const schema = await fetchJson<JsonSchema>(`${SCHEMA_BASE}/${name}`);
        return { name, schema, error: null as string | null };
      } catch (e) {
        return { name, schema: null, error: (e as Error).message };
      }
    })
  );

  const ok = results.filter(r => r.schema).length;
  console.log(`  Fetched ${ok}/${results.length} schemas successfully`);

  const body = results
    .map(r =>
      r.schema
        ? renderProfile(r.name, r.schema)
        : `### \`${r.name}\`\n\n_Could not fetch schema: ${r.error}_\n`
    )
    .join("\n---\n\n");

  const toc = results
    .map(
      r => `- [\`${r.name}\`](#${r.name}--${slug(r.schema?.title ?? r.name)})`
    )
    .join("\n");

  const md = `# NPR CDS Profiles Reference

> Source: ${DOCS_SITE}/api-reference/profiles/
> Raw schemas: ${SCHEMA_BASE}/<name>
> Last fetched: ${TODAY}

NPR CDS documents are validated against JSON Schema "profiles". A document's
\`profiles\` array lists the profiles it implements; each profile contributes a
set of properties and/or constraints. Profiles compose via \`allOf\` — for
example, \`story\` extends \`publishable\` which extends \`document\`.

The tables below are generated from the raw schema at \`${SCHEMA_BASE}/<name>\`.
Descriptions are truncated to 240 chars; consult the raw schema for full text,
pattern constraints, \`$defs\`, and nested link structures.

## Profile Index

${toc}

---

${body}
`;

  writeFileSync(join(DOCS_DIR, "npr-cds-profiles.md"), md);
  console.log("✓ docs/raw/npr-cds-profiles.md updated");
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------- Output: API / narrative pages -------------------------------------

const NARRATIVE_PAGES: Array<{ title: string; path: string }> = [
  { title: "Getting Started", path: "/getting-started.html" },
  {
    title: "Core Concepts: Querying",
    path: "/api-reference/core-concepts/querying/",
  },
  {
    title: "Core Concepts: Links",
    path: "/api-reference/core-concepts/links/",
  },
  {
    title: "Core Concepts: Collections",
    path: "/api-reference/core-concepts/collections/",
  },
  { title: "Document Endpoints", path: "/api-reference/endpoints/document/" },
  { title: "Profile Endpoints", path: "/api-reference/endpoints/profile/" },
  {
    title: "Subscription Endpoints",
    path: "/api-reference/endpoints/subscription/",
  },
  {
    title: "Advanced: Notifications",
    path: "/api-reference/advanced/notifications/",
  },
  {
    title: "Advanced: Client Profiles",
    path: "/api-reference/advanced/client-profiles/",
  },
];

async function updateApiDoc() {
  console.log("Fetching CDS narrative pages…");
  const sections = await Promise.all(
    NARRATIVE_PAGES.map(async p => {
      try {
        const html = await fetchText(`${DOCS_SITE}${p.path}`);
        const md = htmlToMarkdown(extractMain(html));
        return { ...p, md, error: null as string | null };
      } catch (e) {
        return { ...p, md: "", error: (e as Error).message };
      }
    })
  );
  const ok = sections.filter(s => !s.error).length;
  console.log(`  Fetched ${ok}/${sections.length} pages successfully`);

  const body = sections
    .map(s => {
      const header = `## ${s.title}\n\n> Source: ${DOCS_SITE}${s.path}\n\n`;
      return header + (s.error ? `_Could not fetch: ${s.error}_` : s.md);
    })
    .join("\n\n---\n\n");

  const md = `# NPR CDS API Reference

> Source: ${DOCS_SITE}/api-reference/
> Last fetched: ${TODAY}

The NPR Content Distribution Service (CDS) is a REST API for publishing and
retrieving structured content documents. Base URLs:

- Production: \`https://content.api.npr.org\`
- Staging: \`https://stage-content.api.npr.org\`

All requests require bearer-token auth. See the Getting Started section below
for authorization details.

Profile schemas (field-level reference) live in \`npr-cds-profiles.md\`.

---

${body}
`;

  writeFileSync(join(DOCS_DIR, "npr-cds-api.md"), md);
  console.log("✓ docs/raw/npr-cds-api.md updated");
}

// ---------- Main -------------------------------------------------------------

async function main() {
  mkdirSync(DOCS_DIR, { recursive: true });
  await Promise.all([updateProfilesDoc(), updateApiDoc()]);
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
