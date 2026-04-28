# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build              # vite build (frontend) + contentful-app-scripts build-functions --ci
npm run type-check         # tsc --noEmit (covers src/ and functions/)
npm run dev                # vite dev server (frontend UI only)
npm run test               # vitest
npm run upload:dev         # upload built bundle to dev app definition
npm run upload             # upload built bundle to production app definition
npm run preview-cds-document:dev -- <entryId>  # print CDS document JSON without publishing
```

After any code change, run `npm run build` to confirm both the frontend and functions bundles compile cleanly.

### Content type requirements

Add a **JSON Object** field named `nprCDSData` (field ID: `nprCDSData`) to your Story content type. The app stores NPR CDS publish state here (`cdsDocumentId`, `publishedAt`, `contentfulVersion`, `collectionIds`). The field should be hidden from editors.

The app also subscribes to `Entry.unpublish` and `Entry.archive` events to delete the corresponding CDS document and clear `nprCDSData` automatically. The subscription is declared in `contentful-app-manifest.json` and registered when `npm run upload[:dev]` ships the bundle.

### Environment files

All deployment scripts include a `:dev` variant that loads `.env.development` instead of `.env` via `dotenv-cli`. Both files are gitignored (`.env*`). Use `.env.example` as the template.

```
.env.development   # dev app definition ID + credentials
.env               # production app definition ID + credentials
```

Required variables — see `.env.example` for the full list. Key ones:
```
CONTENTFUL_ACCESS_TOKEN=
CONTENTFUL_ORG_ID=
CONTENTFUL_APP_DEF_ID=      # differs between dev and prod
CONTENTFUL_SPACE_ID=
CONTENTFUL_ENVIRONMENT_ID=master
NPR_SERVICE_ID=
CDS_DOCUMENT_PREFIX=contentful-cds
CANONICAL_URL_TEMPLATE=
AUDIO_EMBED_URL_TEMPLATE=
LOCALE=en-US
RECOMMEND_UNTIL_DAYS=7
ENABLE_LAYOUT=false
```

### First-time dev setup
```bash
# 1. Fill in .env.development with shared credentials, leave CONTENTFUL_APP_DEF_ID blank
# 2. Create a new dev app definition
npm run create-app-definition:dev
#    ⚠️  contentful-app-scripts always writes the new CONTENTFUL_APP_DEF_ID back to .env,
#    not to .env.development. Before this command:
#      a. Copy .env to .env.production
#    After this command:
#      a. Copy the new CONTENTFUL_APP_DEF_ID value from .env into .env.development
#      b. Restore .env to its production values (cp .env.production .env)
# 3. Build and upload
npm run build && npm run upload:dev
# 4. Register the app action and resource types for the dev definition
npm run create-app-action:dev
npm run create-resource-entities:dev
```

### Deployment tools
```bash
npm run create-app-definition[:dev]       # register app in Contentful
npm run create-resource-entities[:dev]    # create/update NPR resource type definitions
npm run create-app-action[:dev]           # register the publishToNPR app action
npm run install-app[:dev]                 # install app in a space/environment
```

## Architecture

This is a Contentful App with two independently bundled artifacts:

- **Frontend** (`src/`) — React app, built by Vite to `build/`
- **Functions** (`functions/`) — Contentful serverless functions, built by `contentful-app-scripts` to `build/functions/index.js`

Both share source types via `src/types.ts` and library code via `src/lib/`.

### Functions (`functions/`)

A single function (`nprCDSFunction`) handles all event types, dispatched in `functions/index.ts`:

| Event type | Handler |
|---|---|
| `resources.search` | `searchHandler` — search NPR CDS by title or ID |
| `resources.lookup` | `lookupHandler` — resolve a URN to display data |
| `graphql.resourcetype.mapping` | inline in `index.ts` |
| `graphql.query` | `queryHandler` — resolve CDS data in GraphQL queries |
| `appaction.call` | dispatched by `body.action`: `"checkStatus"` → `checkStatusHandler`, `"delete"` → `deleteHandler`, else → `publishHandler` |

The `appaction.call` handlers all share the single registered action ID `publishToNPR`. Routing is done via the `action` field in the request body.

### Publish pipeline (`src/lib/`)

The publish pipeline is split across two layers to keep `publish.ts` pure/sync:

- **`src/lib/schema.ts`** — Schema adapter layer. All content-model-specific field knowledge lives here. `buildAdapter(locale, params)` is the designated customization point — spread `createDefaultAdapter(locale, "body", params)` and override only differing methods. `resolveBodyEmbeds()` walks a Rich Text document and delegates each embedded entry to `adapter.resolveBodyEmbed()`. Adapter methods receive locale-resolved fields (no `{ "en-US": value }` wrappers) and read linked entries/assets through a `ReadContext = { entrySource }`.

- **`src/lib/entrySource.ts`** — CDA-backed port for reading entries/assets. `createDeliveryEntrySource()` returns an `EntrySource` that only sees published content, preventing drafts from leaking to NPR. `publishHandler` creates one per request using the installed `cdaToken`.

- **`src/lib/publish.ts`** — Pure/sync logic: `buildLayoutFromRichText()`, `buildCdsDocument()`, `publishStoryToCds()`, `checkCdsPublishStatus()`. No CMA/CDA calls. Takes pre-resolved data from the handler layer.

- **`functions/publishHandler.ts`** — Async handler. First validates publish state via CMA (`publishedVersion != null` and `version <= publishedVersion + 1`). Then fetches the story entry and linked references via the CDA-backed `EntrySource` (using `environmentAlias ?? environmentId`, since CDA keys are typically granted on the alias). Runs all adapter methods in parallel (`Promise.all`), calls `resolveBodyEmbeds()`, then `buildCdsDocument()` and `publishStoryToCds()`.

- **`src/lib/utils.ts`** — CDS read API helpers (`fetchByURN`, `queryCDS`) and response mappers (`storyLookupForStory`, etc.). Exports `NPR_CDS_PROD` and `NPR_CDS_STAGING` base URL constants used by all handlers and fetch functions.

- **`src/lib/fetch.ts`** — Higher-level CDS fetch functions (`fetchStory`, `listStories`, etc.) used by lookup/search/query handlers. All pass `cdsEnvironment` from `appParams` through to the `utils` layer, so staging/production is respected for read calls too.

### SchemaAdapter interface

Defined in `src/lib/schema.ts`. To adapt to a different Contentful schema, override methods in `buildAdapter()`:

```typescript
export const buildAdapter = (locale: string, params: AppInstallationParameters = {}): SchemaAdapter => ({
  ...createDefaultAdapter(locale, "body", params),
  async getBylines(fields, ctx) { /* ... */ },
});
```

`this` in any adapter method refers to the final adapter object, so overriding `getSlug` or `getParentSlug` automatically affects `getCanonicalUrl` and `getAudioEmbedUrl` without re-implementing them. The string field-name properties (`titleField`, `audioLinkField`, `publishDateField`, `contentTypeId`) are read directly by the Published Stories page, which iterates locale-keyed CMA entries — overriding them keeps the page consistent with the publish pipeline. `publishDateField` also drives the page's default sort.

The `ReadContext = { entrySource: EntrySource }` is passed to all async adapter methods. Adapter methods receive locale-resolved `fields` (CDA already flattens locales). The default implementation expects fields: `title`, `slug`, `bylineDate`, `shortDescription`, `body`, `primaryImage`, `audioMedia`, `shows`, `hosts`, `reporters`.

### CDS document structure

- Document ID: `{cdsDocumentPrefix}-{contentfulEntryId.toLowerCase()}` (prefix defaults to `"contentful-cds"`)
- Collections are determined at publish time by sidebar checkboxes: NPR One Local (`319418027`) and NPR One Featured (`500549367`) — exported as constants from `publish.ts`
- Layout is built from the Rich Text body with the primary image prepended as the first layout item
- Rich text → CDS asset mapping: paragraph → `text`, solo hyperlink paragraph → `external-link`, embedded photo entry → `image`, mediaLink (YouTube) → `youtube-video`, mediaLink (audio) → `audio`, htmlEmbed → `html-block`

### `nprCDSData` field

Per-entry publish state, locale-keyed JSON Object. Shape is the `NprCDSData` type in `src/types.ts`; the field name is exported from there as `NPR_CDS_DATA_FIELD`. CMA helpers in `functions/nprCDSDataStore.ts` (`getNprCDSData` / `writeNprCDSData` / `clearNprCDSData`). Both write helpers republish only when the entry was clean before the write (`version === publishedVersion + 1`), so unrelated draft changes are never published as a side-effect. After `Entry.unpublish` the entry's `publishedVersion` is null, so the same check naturally skips the republish.

The shared helpers `isOutOfDateWithCDS()` / `hasUnpublishedChanges()` in `src/lib/cdsState.ts` encode the version arithmetic (the `+2` accounts for the post-publish republish bumping `publishedVersion`). Sidebar and Published Stories page both consume them — don't reintroduce the inline arithmetic.

Lifecycle: written on successful CDS publish, cleared on `delete` action and on `Entry.unpublish` events (archive is read-only, so we delete the CDS document but skip the field clear; if the entry is later unarchived, its stale `nprCDSData` will show as a phantom row on the Published Stories page until republished). The page treats `fields.nprCDSData[exists]` as the source of truth for "is this in NPR".

### App configuration parameters (`AppInstallationParameters`)

| Parameter | Purpose |
|---|---|
| `cdsAccessToken` | NPR CDS bearer token with write access |
| `cdaToken` | Contentful Delivery API token. Required to publish — all entry/asset reads during CDS document construction go through the CDA so drafts cannot leak to NPR |
| `nprServiceId` | Sets `owners`, `brandings`, and `authorizedOrgServiceIds` on documents |
| `cdsEnvironment` | `"production"` or `"staging"` — defaults to staging when unset |
| `cdsDocumentPrefix` | Prefix for CDS document IDs, defaults to `"contentful-cds"` |
| `canonicalUrlTemplate` | URL template with `{slug}` / `{parentSlug}` placeholders |
| `audioEmbedUrlTemplate` | Embed player URL template; sets `embeddedPlayerLink` on audio asset |
| `locale` | Contentful locale, defaults to `"en-US"` |
| `recommendUntilDays` | Days after publish date to recommend in NPR One, defaults to `7` |
| `enableLayout` | Whether to build CDS `layout` array from Rich Text body |

### Frontend (`src/`)

- `src/App.tsx` — routes to `ConfigScreen` or `EntrySidebar` based on `sdk.location`
- `src/locations/ConfigScreen.tsx` — app installation settings UI
- `src/locations/EntrySidebar.tsx` — publish/update/delete sidebar. Checks CDS status on mount via `checkStatus` (returns collection IDs so the UI can warn when an update strips a story from a collection it no longer qualifies for). Publish is gated on `publishedVersion != null` and no unpublished changes (`version <= publishedVersion + 1`). NPR One **Local** requires a minimum body word count; **Featured** requires the linked `audioMedia` entry to be published — since `field.onValueChanged` only fires on local link changes, the audio check also re-runs on `sdk.navigator.onSlideInNavigation` returning to slide level 0 so overlay publish/unpublish refreshes the sidebar. `formatSidebarError()` normalizes rejected app-action calls so UI errors aren't rendered as `[object Object]`.
- `src/locations/PublishedStoriesPage.tsx` — page-location route at `/cds-published-stories`. Lists entries that have `nprCDSData`, queried via CMA in batches of 25 with a "Load more" button (server-side pagination on `skip`). Sort is server-side (`fields.${publishDateField}` or `sys.updatedAt`); collection filter is purely a client-side display predicate over the accumulated batches, since CMA only indexes top-level fields. Gated on `sdk.access.can("publish", "Entry")`. Sub-components live under `src/locations/PublishedStories/`.
- `functions/appEventsHandler.ts` — Handles `Entry.unpublish` and `Entry.archive`. Reads stored `cdsDocumentId` via `getNprCDSData`, deletes from CDS first (so archived/read-only entries still get cleaned up in NPR), then on `unpublish` calls `clearNprCDSData` (whose `wasClean` check skips the republish since `publishedVersion` is null after unpublish). Skipped on archive — the entry is read-only and `cma.entry.update` would throw.
- `contentful-app-manifest.json` — The `events.Entry.unpublish` / `events.Entry.archive` block declares the App Event subscription. Registered when `npm run upload[:dev]` ships the bundle. The `accepts` array must include `"appevent.handler"` for the function to receive these events.
- `src/lib/fetch.ts` — CDS read API helpers used by the lookup/search/query handlers

### App action registration (`src/tools/create-app-action.ts`)

`create-app-action[:dev]` is upsert-safe (update, falling back to create on 404), so it can be re-run whenever the action's parameter schema changes. Registered parameters must stay in sync with what the sidebar sends in `cma.appActionCall.createWithResponse` — Contentful rejects unknown fields with a 422 before the function is invoked.
