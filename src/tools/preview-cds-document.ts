/**
 * CLI tool to preview the CDS document that would be published for a given
 * Contentful entry ID. Outputs the document JSON to stdout.
 *
 * Usage:
 *   npm run preview-cds-document -- <entryId>
 */

import { buildCdsDocument, buildLayoutFromRichText } from "../lib/publish";
import { buildAdapter, resolveBodyEmbeds } from "../lib/schema";
import type { ReadContext } from "../lib/schema";
import { createDeliveryEntrySource } from "../lib/entrySource";
import type { AppInstallationParameters } from "../types";
import type { Document } from "@contentful/rich-text-types";

const entryId = process.argv[2];
if (!entryId) {
  console.error("Usage: npm run preview-cds-document -- <entryId>");
  process.exit(1);
}

const {
  CONTENTFUL_CDA_TOKEN: cdaToken = "",
  CONTENTFUL_SPACE_ID: spaceId = "",
  CONTENTFUL_ENVIRONMENT_ID: environmentId = "master",
  NPR_SERVICE_ID: nprServiceId,
  CDS_DOCUMENT_PREFIX: cdsDocumentPrefix,
  CANONICAL_URL_TEMPLATE: canonicalUrlTemplate,
  AUDIO_EMBED_URL_TEMPLATE: audioEmbedUrlTemplate,
  LOCALE: locale = "en-US",
  RECOMMEND_UNTIL_DAYS: recommendUntilDaysRaw,
  ENABLE_LAYOUT: enableLayoutRaw = "false",
} = process.env;

const recommendUntilDays = recommendUntilDaysRaw
  ? Number(recommendUntilDaysRaw)
  : undefined;

const enableLayout = ["true", "1", "on", 1, true].includes(
  enableLayoutRaw?.toLowerCase?.() || ""
);

if (!cdaToken) {
  console.error("CONTENTFUL_CDA_TOKEN is required");
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

const entrySource = createDeliveryEntrySource({
  token: cdaToken,
  spaceId,
  environmentId,
  locale,
});
const ctx: ReadContext = { entrySource };
const adapter = buildAdapter(locale, params);

const main = async () => {
  const storyEntry = await entrySource.getEntry(entryId);
  if (!storyEntry) {
    console.error(`Entry ${entryId} not found via Content Delivery API.`);
    process.exit(1);
  }
  const fields = storyEntry.fields;

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
    ? (fields[adapter.bodyField] as Document | undefined)
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
