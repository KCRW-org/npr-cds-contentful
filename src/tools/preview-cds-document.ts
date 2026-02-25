/**
 * CLI tool to preview the CDS document that would be published for a given
 * Contentful entry ID. Outputs the document JSON to stdout.
 *
 * Usage:
 *   npm run preview-cds-document -- <entryId>
 */

import { createClient } from "contentful-management";
import { buildCdsDocument, buildLayoutFromRichText } from "../lib/publish";
import { buildAdapter, resolveBodyEmbeds } from "../lib/schema";
import type { CmaContext } from "../lib/schema";
import type { AppInstallationParameters } from "../types";
import type { Document } from "@contentful/rich-text-types";

const entryId = process.argv[2];
if (!entryId) {
  console.error("Usage: npm run preview-cds-document -- <entryId>");
  process.exit(1);
}

const {
  CONTENTFUL_ACCESS_TOKEN: accessToken = "",
  CONTENTFUL_SPACE_ID: spaceId = "",
  CONTENTFUL_ENVIRONMENT_ID: environmentId = "master",
  NPR_SERVICE_ID: nprServiceId,
  CDS_DOCUMENT_PREFIX: cdsDocumentPrefix,
  CANONICAL_URL_TEMPLATE: canonicalUrlTemplate,
  AUDIO_EMBED_URL_TEMPLATE: audioEmbedUrlTemplate,
  LOCALE: locale = "en-US",
  RECOMMEND_UNTIL_DAYS: recommendUntilDaysRaw,
  ENABLE_LAYOUT: enableLayout = false,
} = process.env;

const recommendUntilDays = recommendUntilDaysRaw
  ? Number(recommendUntilDaysRaw)
  : undefined;

if (!accessToken) {
  console.error("CONTENTFUL_ACCESS_TOKEN is required");
  process.exit(1);
}
if (!spaceId) {
  console.error("CONTENTFUL_SPACE_ID is required");
  process.exit(1);
}

const params: AppInstallationParameters = {
  nprServiceId,
  cdsDocumentPrefix,
  canonicalUrlTemplate,
  audioEmbedUrlTemplate,
  locale,
};

const cma = createClient({ accessToken }, { type: "plain" });
const ctx: CmaContext = { cma, spaceId, environmentId };
const adapter = buildAdapter(locale, params);

const main = async () => {
  const storyEntry = await cma.entry.get({ spaceId, environmentId, entryId });
  const fields = (storyEntry.fields ?? {}) as Record<string, unknown>;

  const title = adapter.getTitle(fields);
  const teaser = adapter.getTeaser(fields);
  const publishDateRaw = adapter.getPublishDate(fields);
  const publishDateTime = publishDateRaw
    ? new Date(publishDateRaw).toISOString()
    : undefined;

  const [
    canonicalUrl,
    additionalWebPages,
    additionalCollections,
    documentProperties,
    image,
    audio,
    bylines,
  ] = await Promise.all([
    adapter.getCanonicalUrl(fields, ctx),
    adapter.getAdditionalWebPages(fields, ctx),
    adapter.getAdditionalCollections(fields, ctx),
    adapter.getDocumentProperties(fields, ctx),
    adapter.getImage(fields, ctx),
    adapter.getAudio(fields, ctx),
    adapter.getBylines(fields, ctx),
  ]);

  const bodyDoc = enableLayout
    ? ((fields[adapter.bodyField] as Record<string, unknown> | undefined)?.[
        adapter.locale
      ] as Document | undefined)
    : undefined;
  const embedMap = bodyDoc
    ? await resolveBodyEmbeds(bodyDoc, adapter, ctx)
    : new Map();
  const layout = bodyDoc
    ? buildLayoutFromRichText(bodyDoc, embedMap)
    : undefined;

  const cdsDoc = buildCdsDocument({
    entryId,
    title,
    teaser,
    publishDateTime,
    canonicalUrl,
    additionalWebPages,
    additionalCollections,
    documentProperties,
    image,
    audio,
    bylines,
    nprServiceId,
    cdsDocumentPrefix,
    recommendUntilDays,
    layout,
  });

  console.log(JSON.stringify(cdsDoc, null, 2));
};

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
