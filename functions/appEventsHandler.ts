import type { AppEventHandler } from "./types";
import { NPR_CDS_PROD, NPR_CDS_STAGING } from "../src/lib/utils";
import { clearNprCDSData, getNprCDSData } from "./nprCDSDataStore";

export const appEventsHandler: AppEventHandler = async (event, context) => {
  const topic =
    event.headers?.["x-contentful-topic"] ||
    event.headers?.["X-Contentful-Topic"];
  if (typeof topic !== "string") return;
  const match = topic.match(/^ContentManagement\.Entry\.(unpublish|archive)$/);
  if (!match) return;
  const action = match[1] as "unpublish" | "archive";

  const entryId = (event.body?.sys as { id?: string } | undefined)?.id;
  if (!entryId) return;

  const { cma, spaceId, environmentId } = context;
  if (!cma) return;

  const {
    locale = "en-US",
    cdsAccessToken,
    cdsEnvironment,
    cdsDocumentPrefix = "contentful-cds",
  } = context.appInstallationParameters as {
    locale?: string;
    cdsAccessToken?: string;
    cdsEnvironment?: "production" | "staging";
    cdsDocumentPrefix?: string;
  };

  // Resolve the CDS document id from stored state, falling back to a derived id.
  let cdsDocumentId = `${cdsDocumentPrefix}-${entryId.toLowerCase()}`;
  try {
    const { data } = await getNprCDSData(entryId, locale, {
      cma,
      spaceId,
      environmentId,
    });
    if (data?.cdsDocumentId) cdsDocumentId = data.cdsDocumentId;
  } catch (err) {
    console.warn(
      `[appEventsHandler] Could not read entry ${entryId} on ${action}:`,
      err
    );
  }

  // Delete from CDS first — archived entries are read-only, so a subsequent
  // entry.update would throw. Doing the external side-effect first guarantees
  // the story is removed from NPR even if we can't clear the field.
  if (cdsAccessToken) {
    const baseUrl =
      cdsEnvironment === "production" ? NPR_CDS_PROD : NPR_CDS_STAGING;
    try {
      const response = await fetch(`${baseUrl}/v1/documents/${cdsDocumentId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cdsAccessToken}`,
        },
      });
      if (response.status !== 204 && response.status !== 404) {
        const text = await response.text();
        console.warn(
          `[appEventsHandler] CDS delete returned status ${response.status} for document ${cdsDocumentId}:`,
          text
        );
      }
    } catch (deleteErr) {
      console.warn(
        `[appEventsHandler] Failed to delete CDS document ${cdsDocumentId}:`,
        deleteErr
      );
    }
  }

  // Clear nprCDSData on the entry — only on unpublish. Archive makes the entry
  // read-only, so cma.entry.update would throw; the CDS-side delete above is
  // the user-visible cleanup in that case. clearNprCDSData's "wasClean" guard
  // correctly skips republish here since publishedVersion is null after
  // unpublish.
  //
  // Caveat: if an archived entry is later unarchived, its stale nprCDSData
  // remains and the Published Stories page will show a phantom row pointing at
  // a deleted CDS document. Re-publishing or removing from the sidebar will
  // reconcile it. This is rare enough that we accept it.
  if (action === "unpublish") {
    try {
      await clearNprCDSData(entryId, locale, { cma, spaceId, environmentId });
    } catch (updateErr) {
      console.warn(
        `[appEventsHandler] Could not clear nprCDSData on entry ${entryId} on unpublish:`,
        updateErr
      );
    }
  }
};
