import type { AppActionHandler } from "./types";
import {
  buildCdsDocument,
  publishStoryToCds,
  buildLayoutFromRichText,
  NPR_ONE_LOCAL_COLLECTION_ID,
  NPR_ONE_FEATURED_COLLECTION_ID,
} from "../src/lib/publish";
import { NPR_CDS_PROD, NPR_CDS_STAGING } from "../src/lib/utils";
import { buildAdapter, resolveBodyEmbeds } from "../src/lib/schema";
import type { CmaContext } from "../src/lib/schema";
import type {
  AppInstallationParameters,
  PublishActionBody,
  PublishActionResult,
} from "../src/types";
import type { Document } from "@contentful/rich-text-types";

export const publishHandler: AppActionHandler = async (event, context) => {
  const body = event.body as PublishActionBody;
  const { entryId, submitToNprOneLocal, submitToNprOneFeatured } = body;

  try {
    const {
      cdsAccessToken,
      nprServiceId,
      cdsEnvironment,
      cdsDocumentPrefix = "contentful-cds",
      locale = "en-US",
      enableLayout = false,
      recommendUntilDays = 7,
    } = context.appInstallationParameters as AppInstallationParameters;

    const baseUrl =
      cdsEnvironment === "production" ? NPR_CDS_PROD : NPR_CDS_STAGING;

    const collectionIds: string[] = [];
    if (submitToNprOneLocal) collectionIds.push(NPR_ONE_LOCAL_COLLECTION_ID);
    if (submitToNprOneFeatured)
      collectionIds.push(NPR_ONE_FEATURED_COLLECTION_ID);

    if (!cdsAccessToken) {
      return {
        success: false,
        error: "Missing CDS access token in app configuration",
      } as PublishActionResult;
    }

    const { spaceId, environmentId, cma } = context;
    if (!cma) {
      return {
        success: false,
        error: "CMA client not available in function context",
      } as PublishActionResult;
    }

    const ctx: CmaContext = { cma, spaceId, environmentId };
    const adapter = buildAdapter(
      locale,
      context.appInstallationParameters as AppInstallationParameters
    );

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

    if (!canonicalUrl) {
      return {
        success: false,
        error:
          "Cannot publish: no canonical URL could be generated for this entry. Check the Canonical URL Template in app configuration.",
      } as PublishActionResult;
    }

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
      recommendUntilDays,
      cdsDocumentPrefix,
      image,
      audio,
      bylines,
      nprServiceId,
      collectionIds,
      layout,
    });

    const result = await publishStoryToCds(cdsDoc, cdsAccessToken, baseUrl);

    if (!result.ok) {
      return {
        success: false,
        error: `CDS returned ${result.status}: ${JSON.stringify(result.body)}`,
      } as PublishActionResult;
    }

    const documentUrl = `${baseUrl}/v1/documents/${cdsDoc.id}`;
    return {
      success: true,
      documentId: cdsDoc.id,
      documentUrl,
    } as PublishActionResult;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message } as PublishActionResult;
  }
};
