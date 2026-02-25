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

- **`src/lib/schema.ts`** — Schema adapter layer. All content-model-specific field knowledge lives here. `buildAdapter(locale, params)` is the designated customization point — spread `createDefaultAdapter(locale, "body", params)` and override only differing methods. `resolveBodyEmbeds()` walks a Rich Text document and delegates each embedded entry to `adapter.resolveBodyEmbed()`.

- **`src/lib/publish.ts`** — Pure/sync logic: `buildLayoutFromRichText()`, `buildCdsDocument()`, `publishStoryToCds()`, `checkCdsPublishStatus()`. No CMA calls. Takes pre-resolved data from the handler layer.

- **`functions/publishHandler.ts`** — Async handler: fetches the story entry via CMA, runs all adapter methods in parallel (`Promise.all`), calls `resolveBodyEmbeds()`, then calls `buildCdsDocument()` and `publishStoryToCds()`.

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

`this` in any adapter method refers to the final adapter object, so overriding `getSlug` or `getParentSlug` automatically affects `getCanonicalUrl` and `getAudioEmbedUrl` without re-implementing them.

The `CmaContext = { cma: PlainClientAPI, spaceId, environmentId }` is passed to all async adapter methods. The default implementation expects fields: `title`, `slug`, `bylineDate`, `shortDescription`, `body`, `primaryImage`, `audioMedia`, `shows`, `hosts`, `reporters`.

### CDS document structure

- Document ID: `{cdsDocumentPrefix}-{contentfulEntryId.toLowerCase()}` (prefix defaults to `"contentful-cds"`)
- Collections are determined at publish time by sidebar checkboxes: NPR One Local (`319418027`) and NPR One Featured (`500549367`) — exported as constants from `publish.ts`
- Layout is built from the Rich Text body with the primary image prepended as the first layout item
- Rich text → CDS asset mapping: paragraph → `text`, solo hyperlink paragraph → `external-link`, embedded photo entry → `image`, mediaLink (YouTube) → `youtube-video`, mediaLink (audio) → `audio`, htmlEmbed → `html-block`

### App configuration parameters (`AppInstallationParameters`)

| Parameter | Purpose |
|---|---|
| `cdsAccessToken` | NPR CDS bearer token with write access |
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
- `src/locations/EntrySidebar.tsx` — publish/update/delete sidebar; checks CDS publish status on mount via `checkStatus` action; gates publish button on `entrySys.publishedVersion != null`
- `src/lib/fetch.ts` — CDS read API helpers used by the lookup/search/query handlers
