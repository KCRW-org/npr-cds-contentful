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
import type { ReadContext } from "../src/lib/schema";
import { createDeliveryEntrySource } from "../src/lib/entrySource";
import type {
  AppInstallationParameters,
  PublishActionBody,
  PublishActionResult,
  NprCDSData,
} from "../src/types";
import type { Document } from "@contentful/rich-text-types";
import { writeNprCDSData } from "./nprCDSDataStore";

export const publishHandler: AppActionHandler = async (event, context) => {
  const body = event.body as PublishActionBody;
  const {
    entryId,
    submitToNprOneLocal,
    submitToNprOneFeatured,
    environmentAlias,
  } = body;

  try {
    const params =
      context.appInstallationParameters as AppInstallationParameters;
    const {
      cdsAccessToken,
      cdaToken,
      nprServiceId,
      cdsEnvironment,
      cdsDocumentPrefix = "contentful-cds",
      locale = "en-US",
      enableLayout = false,
      recommendUntilDays = 7,
      cdaIncludeDepth = 3,
    } = params;

    const baseUrl =
      cdsEnvironment === "production" ? NPR_CDS_PROD : NPR_CDS_STAGING;

    const collectionIds: string[] = [];
    if (submitToNprOneLocal) collectionIds.push(NPR_ONE_LOCAL_COLLECTION_ID);
    if (submitToNprOneFeatured)
      collectionIds.push(NPR_ONE_FEATURED_COLLECTION_ID);

    if (collectionIds.length === 0) {
      return {
        success: false,
        error: "Select at least one NPR One collection before publishing.",
      } as PublishActionResult;
    }

    if (!cdsAccessToken) {
      return {
        success: false,
        error: "Missing CDS access token in app configuration",
      } as PublishActionResult;
    }
    if (!cdaToken) {
      return {
        success: false,
        error:
          "Content Delivery API token not configured. Add it in the app settings.",
      } as PublishActionResult;
    }

    const { spaceId, environmentId, cma } = context;
    if (!cma) {
      return {
        success: false,
        error: "CMA client not available in function context",
      } as PublishActionResult;
    }

    // Validate publish state against the CMA before touching the CDA.
    // `version === publishedVersion + 1` means the last saved version *is*
    // the published version (no pending draft changes).
    const entryForCheck = await cma.entry.get({
      spaceId,
      environmentId,
      entryId,
    });
    const sys = entryForCheck.sys as {
      version: number;
      publishedVersion?: number | null;
    };
    if (sys.publishedVersion == null) {
      return {
        success: false,
        error:
          "Entry must be published in Contentful before sending to NPR CDS.",
      } as PublishActionResult;
    }
    if (sys.version > sys.publishedVersion + 1) {
      return {
        success: false,
        error:
          "Entry has unpublished changes. Publish all changes in Contentful before sending to NPR CDS.",
      } as PublishActionResult;
    }

    // CDA keys are typically granted access to the environment alias (e.g.
    // "master") rather than the underlying environment id the action runs in.
    // The sidebar sends `environmentAlias` when available.
    const cdaEnvironmentId = environmentAlias ?? environmentId;
    const entrySource = createDeliveryEntrySource({
      token: cdaToken,
      spaceId,
      environmentId: cdaEnvironmentId,
      locale,
    });
    const ctx: ReadContext = { entrySource };
    const adapter = buildAdapter(locale, params);

    // Fetch the story entry with linked entries/assets bundled in a single
    // CDA request. Subsequent adapter reads are served from the cache; any
    // reference not covered by `cdaIncludeDepth` resolves to `null` and the
    // entry source logs a warning.
    const storyEntry = await entrySource.prime(entryId, cdaIncludeDepth);
    if (!storyEntry) {
      return {
        success: false,
        error: `Entry ${entryId} not accessible via the Content Delivery API. Verify the CDA token has access to the "${cdaEnvironmentId}" environment and that the entry is published.`,
      } as PublishActionResult;
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
      video,
      bylines,
    ] = await Promise.all([
      adapter.getCanonicalUrl(fields, ctx),
      adapter.getAdditionalWebPages(fields, ctx),
      adapter.getAdditionalCollections(fields, ctx),
      adapter.getDocumentProperties(fields, ctx),
      adapter.getImage(fields, ctx),
      adapter.getAudio(fields, ctx),
      adapter.getVideo(fields, ctx),
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
      recommendUntilDays,
      cdsDocumentPrefix,
      image,
      audio,
      video,
      bylines,
      nprServiceId,
      collectionIds,
      layout,
    });

    const result = await publishStoryToCds(cdsDoc, cdsAccessToken, baseUrl);

    if (!result.ok) {
      const bodyString = formatErrorBody(result.body);
      console.error(
        `[publishHandler] CDS PUT failed for ${cdsDoc.id}: status=${result.status} body=${bodyString}`
      );
      return {
        success: false,
        error: `NPR CDS rejected the document (HTTP ${result.status}): ${bodyString}`,
      } as PublishActionResult;
    }

    // Write nprCDSData to persist publish state locally
    const nprCDSData: NprCDSData = {
      cdsDocumentId: cdsDoc.id,
      publishedAt: new Date().toISOString(),
      contentfulVersion: sys.publishedVersion,
      collectionIds,
    };
    await writeNprCDSData(
      entryId,
      locale,
      nprCDSData,
      { cma, spaceId, environmentId },
      entryForCheck
    );

    const documentUrl = `${baseUrl}/v1/documents/${cdsDoc.id}`;
    return {
      success: true,
      documentId: cdsDoc.id,
      documentUrl,
    } as PublishActionResult;
  } catch (err: unknown) {
    const message = formatUnknownError(err);
    console.error(
      `[publishHandler] Unhandled error for entry ${body?.entryId}: ${message}`,
      err
    );
    return { success: false, error: message } as PublishActionResult;
  }
};

const formatErrorBody = (body: unknown): string => {
  if (body == null) return "(empty response body)";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
};

const formatUnknownError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
};
