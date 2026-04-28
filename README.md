# NPR CDS Integration for Contentful

A Contentful app that integrates with the [NPR Content Distribution Service (CDS)](https://npr.github.io/content-distribution-service/). It provides two capabilities:

1. **Read** — Reference NPR Stories and Programs from Contentful entries using [Native External References](https://www.contentful.com/help/orchestration/native-external-references/), with GraphQL support for inline querying.
2. **Write** — Publish Contentful story entries to the NPR CDS write API directly from the entry sidebar.

---

## Setup

### Prerequisites

- An NPR CDS API token with write access (obtain from NPR Member Partnership)
- A Contentful organization with app definition creation rights

### Installation

Copy `.env.example` to `.env` and fill in your credentials:

```
CONTENTFUL_ORG_ID=
CONTENTFUL_APP_DEF_ID=
CONTENTFUL_ACCESS_TOKEN=
CONTENTFUL_SPACE_ID=
CONTENTFUL_ENVIRONMENT_ID=master
```

Create the app definition, build and upload the function, register the app action, and create the resource type entities:

```bash
npm run create-app-definition
npm run build && npm run upload
npm run create-app-action
npm run create-resource-entities
```

`create-app-action` registers the `publishToNPR` action used by the entry sidebar. Re-run it whenever the action's parameter schema changes — the script is upsert-safe.

### Story content type requirement

Before publishing, add a hidden **JSON Object** field to your Story content type:

| Field ID | Type | Visibility |
|---|---|---|
| `nprCDSData` | JSON Object | Hidden from editors |

The app stores per-entry NPR CDS publish state here (`cdsDocumentId`, `publishedAt`, `contentfulVersion`, `collectionIds`). It is also used as the source of truth for the Published Stories page and is automatically cleared when an entry is unpublished or archived in Contentful.

### Dev vs Production app definitions

The above `create-app-definition`, `upload`, and `create-resource-entities` commands provide a variant with a `:dev` prefix that is used to create, upload, and configure a development version of the app.

These commands use a `.env.development` configuration file instead of the default production `.env` files. These files should have different `CONTENTFUL_APP_DEF_ID` values to keep dev and production deployments isolated. For example:

```bash
npm run build && npm run upload:dev   # deploy to dev app definition
npm run build && npm run upload  # deploy to production app definition
```

> **Note:** `npm run create-app-definition` and `npm run create-app-definition:dev` will set new `CONTENTFUL_APP_DEF_ID` and `CONTENTFUL_ACCESS_TOKEN` values in `.env`. If running the `:dev` version you will need to copy the values from `.env` into `.env.development` and restore `.env` the production values if they were already set.

### Enabling in a Contentful environment

After uploading, go to **Apps → Custom Apps** in your Contentful environment and click **Install**. Configure the app parameters in the configuration screen (see below).

The publish Sidebar and custom NPR content reference fields can be enabled on specific content types using the Contentful Content Type editor interface.

---

## Configuration

All settings are managed in the app's Contentful configuration screen:

| Parameter | Description | Default |
|---|---|---|
| **API Token** | NPR CDS Bearer token with write access | — |
| **Contentful Delivery API Token** | CDA token. **Required to publish** — all entry/asset reads during CDS document construction go through the CDA so unpublished drafts cannot leak to NPR | — |
| **NPR Service ID** | Your NPR organization service ID; sets `owners` and `brandings` on CDS documents | — |
| **CDS Environment** | `staging` or `production` | `staging` |
| **CDS Document Prefix** | Prefix for CDS document IDs (e.g. `mystation` → `mystation-<entryId>`) | `contentful-cds` |
| **Canonical URL Template** | URL pattern for story web pages. Use `{slug}` and optionally `{parentSlug}` | — |
| **Audio Embed URL Template** | URL pattern for the audio embedded player link. Supports `{slug}` and `{parentSlug}` | — |
| **Locale** | Contentful locale to read fields from | `en-US` |
| **Recommend Until (days)** | Days after publish date to recommend in NPR One | `7` |
| **Include story body layout** | Convert Rich Text body to a CDS `layout` array | off |
| **CDA Include Depth** | Reference depth for the single CDA request that primes story publishing. Valid range 1–10 | `3` |

> **Warning:** Changing **CDS Document Prefix** on a site with existing CDS documents will cause stories to be re-published under new IDs. The old documents will remain in CDS and must be deleted manually.

---

## Publishing Stories to NPR CDS

The app adds a sidebar widget to entry types it is installed on. From the sidebar you can:

- Select **NPR Local** and/or **NPR Featured** collections
- **Publish / Update** the story in the NPR CDS
- **Remove** the story from the NPR CDS (with confirmation)

The sidebar shows the current CDS publication status for the entry, including a "Needs update" warning when the entry has been edited in Contentful since the last CDS publish. Publishing is gated on the entry being published in Contentful with no pending draft changes; collection eligibility (Local requires a minimum body word count or published audio; Featured requires the linked audio entry to be published) is checked client-side and reflected in the checkbox state.

### Automatic cleanup

The app subscribes to `Entry.unpublish` and `Entry.archive` events (declared in `contentful-app-manifest.json` and registered when the bundle is uploaded). On either event, the corresponding CDS document is deleted. On unpublish, the `nprCDSData` field is cleared as well; on archive the field clear is skipped because archived entries are read-only. If an archived entry is later unarchived, its stale `nprCDSData` will remain until the entry is re-published or removed via the sidebar.

### Published Stories page

The app registers a page-location route at `/cds-published-stories` that lists all entries currently in NPR CDS. The page queries Contentful via CMA for entries with `fields.nprCDSData` set, displays each row with status badges (Needs update, Has unpublished changes, Has audio), supports sorting by publish date or last-updated, and filters client-side by NPR collection. Stories load in batches of 25 with a "Load more" button. Access is gated on the user having publish permission for entries.


### Rich Text → CDS layout mapping

When **Include story body layout** is enabled:

| Rich Text block | CDS asset profile |
|---|---|
| Paragraph (text / mixed content) | `text` — serialised as HTML |
| Paragraph containing only a hyperlink | `external-link` |
| Heading, list, blockquote, table | `text` — serialised as HTML |
| Embedded `photo` entry | `image` |
| Embedded `mediaLink` entry (YouTube URL) | `youtube-video` |
| Embedded `mediaLink` entry (audio URL) | `audio` |
| Embedded Contentful asset | `image` |
| Embedded `htmlEmbed` entry | `html-block` |

---

## Adapting to your content model

All schema-specific logic — field names, byline resolution, canonical URL construction, embed resolution — is isolated in **`src/lib/schema.ts`**. Edit `buildAdapter` at the bottom of that file to adapt the pipeline to your Contentful space without touching the rest of the codebase.

### The `SchemaAdapter` interface

```typescript
type ReadContext = { entrySource: EntrySource };

type SchemaAdapter = {
  locale: string;
  bodyField: string;          // Rich Text field ID for the story body
  titleField: string;         // Field name for the story title
  audioLinkField: string;     // Field name linking to the primary audio entry
  publishDateField: string;   // Field name for the publish date
  contentTypeId: string;      // Contentful content type ID for stories

  // Synchronous extractors — `fields` is locale-resolved (no `[locale]` keys).
  getTitle(fields): string;
  getSlug(fields): string;
  getPublishDate(fields): string | undefined;
  getTeaser(fields): string | undefined;

  // Async resolvers — read linked entries/assets via `ctx.entrySource` (CDA-backed).
  getBylines(fields, ctx): Promise<string[]>;
  getParentSlug(fields, ctx): Promise<string | undefined>;
  getCanonicalUrl(fields, ctx): Promise<string | undefined>;
  getAdditionalWebPages(fields, ctx): Promise<Array<{ href: string; rels: string[] }>>;
  getAdditionalCollections(fields, ctx): Promise<Array<{ href: string; rels: string[] }>>;
  getDocumentProperties(fields, ctx): Promise<Record<string, unknown>>;
  getImage(fields, ctx): Promise<ResolvedImage | undefined>;
  getAudio(fields, ctx): Promise<{ url: string; duration?: number } | undefined>;
  getAudioEmbedUrl(fields, ctx): Promise<string | undefined>;

  // Called for each embedded entry in the Rich Text body
  resolveBodyEmbed(entryId, contentTypeId, ctx): Promise<ResolvedEmbedEntry>;
};
```

`ctx.entrySource` exposes `getEntry(id)` and `getAsset(id)`, both backed by a single CDA request primed at the start of publishing — so all reads are cached and only published content is visible. Field values returned from `entrySource.getEntry()` are locale-resolved by the CDA; do not subscript with `[locale]`.

The string field-name properties (`titleField`, `audioLinkField`, `publishDateField`, `contentTypeId`) are read both by the publish pipeline and by the Published Stories page when iterating CMA-shaped entries. Override them once and both stay in sync.

`getAdditionalWebPages` appends entries to the document's `webPages` array (valid `rels`: `apple-podcasts`, `spotify`, `google-podcasts`, `pocket-casts`, `stitcher`, `amazon-music`, `iheartradio`, `youtube-music`, `npr-one`, `appears-on`).

`getAdditionalCollections` appends collection references beyond the NPR One curation IDs selected in the sidebar.

`getDocumentProperties` merges arbitrary top-level properties onto the CDS document (e.g. `nprDisplayType`, `nprWebsitePath`).

### Default implementation

`createDefaultAdapter(locale, bodyField?, params?)` returns a `SchemaAdapter` wired to this content model:

| Method / property | Default behaviour |
|---|---|
| `contentTypeId` | `"story"` |
| `titleField` | `"title"` |
| `audioLinkField` | `"audioMedia"` |
| `publishDateField` | `"bylineDate"` |
| `bodyField` | `"body"` |
| `getTitle` | `fields[titleField]` |
| `getSlug` | `fields.slug` |
| `getPublishDate` | `fields[publishDateField]` |
| `getTeaser` | Plain-text conversion of `fields.shortDescription` (Markdown) |
| `getBylines` | Fetches entries linked via `fields.hosts` + `fields.reporters`, reads `name` |
| `getParentSlug` | Fetches the first entry linked via `fields.shows`, reads its `slug` |
| `getCanonicalUrl` | Applies the **Canonical URL Template** app parameter; substitutes `{slug}` and `{parentSlug}` using `getSlug` / `getParentSlug` |
| `getImage` | Fetches `fields.primaryImage` → `photo` entry → asset |
| `getAudio` | Fetches `fields[audioLinkField]` → `mediaLink` entry, reads `mediaUrl` + `duration`; calls `getAudioEmbedUrl` |
| `getAudioEmbedUrl` | Applies the **Audio Embed URL Template** app parameter; substitutes `{slug}` and `{parentSlug}` |
| `resolveBodyEmbed` | `"photo"` → image; `"mediaLink"` → YouTube or audio; `"htmlEmbed"` → html-block; others → skipped |

Default `photo` fields: `asset` (Asset link), `altText`, `focusHint`, `photoCaption`, `photoCredit`, `rightsHolder`.

Default `mediaLink` fields: `mediaUrl` (string), `duration` (string of seconds).

### Overriding individual methods

```typescript
// src/lib/schema.ts

export const buildAdapter = (locale: string, params: AppInstallationParameters = {}): SchemaAdapter => ({
  ...createDefaultAdapter(locale, "body", params),

  // Example: rename the title field
  titleField: "headline",

  // Example: single "contributors" field instead of separate hosts + reporters
  async getBylines(fields, ctx) {
    const links = (fields.contributors ?? []) as Array<{ sys: { id: string } }>;
    const names = await Promise.all(
      links.map(async (link) => {
        const entry = await ctx.entrySource.getEntry(link.sys.id);
        return (entry?.fields.fullName as string | undefined) ?? null;
      })
    );
    return names.filter((n): n is string => !!n);
  },

  // Example: add podcast platform links
  async getAdditionalWebPages(fields, ctx) {
    // ... resolve linked entries via ctx.entrySource and return hrefs with platform rels
    return [];
  },
});
```

Notes for adapter authors:

- `fields` is locale-resolved — read `fields.contributors` directly, not `fields.contributors[locale]`.
- `ctx.entrySource.getEntry(id)` returns `null` for unpublished, archived, or missing entries (and for any reference deeper than the configured **CDA Include Depth**). The function logs a warning when this happens so misconfigured depth shows up in CDS function logs.
- `ctx.entrySource` is read-only and only sees published content. There is no CMA escape hatch in adapter methods — drafts cannot leak into the CDS document by design.

---

## Referencing NPR content (read-only)

Once installed, NPR Stories and Programs can be referenced from any Contentful entry using a Reference field with **Source: Different spaces and external sources** and **NPR** as the content source.

> Due to CDS API limitations, the reference search bar only works with exact NPR content IDs.

### GraphQL queries

Referenced NPR content can be resolved inline in Contentful GraphQL queries. Available fields on both Story and Collection nodes:

- `id`, `urn`, `title`, `subtitle`, `description`, `publishDateTime`, `externalUrl`
- `image` — `url`, `altText`, `scalable`, `urlTemplate`

Story nodes additionally provide:
- `audio` — `url`, `duration`

Collection nodes additionally provide:
- `items(sort?, limit?, skip?, requireImages?, requireAudio?)` — paginated list of Story nodes

Example query:

```graphql
query {
  program(id: "...") {
    title
    nprProgram {
      node {
        ... on Node_NPR_Collection {
          id
          title
          items(limit: 20, requireAudio: true) {
            id
            title
            audio { url duration }
            image { url altText urlTemplate }
          }
        }
      }
    }
  }
}
```

See the NPR CDS docs for [valid `sort` types](https://npr.github.io/content-distribution-service/api-reference/core-concepts/querying/#valid-sort-types).

---

## Development tools

### Preview a CDS document without publishing

```bash
npm run preview-cds-document -- <entryId>
```

Fetches a story entry and prints the CDS document JSON locally. Reads from `.env`:

```
CONTENTFUL_ACCESS_TOKEN=
CONTENTFUL_SPACE_ID=
CONTENTFUL_ENVIRONMENT_ID=master
NPR_SERVICE_ID=
CDS_DOCUMENT_PREFIX=contentful-cds
LOCALE=en-US
```

### Update the functions when any schema changes are made

If you make updates in `src/lib/schema.ts`, you will need to build and upload the updated function:

```bash
npm run build && npm run upload        # production
npm run build && npm run upload:dev    # dev
```

If you change the `publishToNPR` action's parameter schema (in `src/tools/create-app-action.ts`), re-run the registration script — Contentful rejects unknown parameter fields with a 422 before the function is invoked:

```bash
npm run create-app-action              # production
npm run create-app-action:dev          # dev
```

### Install the app into a space

```bash
npm run install-app[:dev]
```

---

## Notes

- The CDS Query API does not support full-text search; the reference search bar requires exact NPR content IDs.
- The Collection search lists all programs alphabetically by title.
- The Story search lists published stories sorted by `editorial`.
