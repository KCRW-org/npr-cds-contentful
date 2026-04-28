import type { AppActionHandler } from "./types";
import type { DeleteActionBody, DeleteActionResult } from "../src/types";
import { NPR_CDS_PROD, NPR_CDS_STAGING } from "../src/lib/utils";
import { clearNprCDSData, getNprCDSData } from "./nprCDSDataStore";

export const deleteHandler: AppActionHandler = async (event, context) => {
  const body = event.body as DeleteActionBody;
  const { entryId } = body;

  try {
    const {
      cdsAccessToken,
      cdsEnvironment,
      cdsDocumentPrefix = "contentful-cds",
      locale = "en-US",
    } = context.appInstallationParameters as {
      cdsAccessToken?: string;
      cdsEnvironment?: string;
      cdsDocumentPrefix?: string;
      locale?: string;
    };

    if (!cdsAccessToken) {
      return {
        success: false,
        error: "Missing CDS access token in app configuration",
      } as DeleteActionResult;
    }

    const baseUrl =
      cdsEnvironment === "production" ? NPR_CDS_PROD : NPR_CDS_STAGING;

    const { cma, spaceId, environmentId } = context;

    // Prefer the stored cdsDocumentId — handles the case where cdsDocumentPrefix
    // was changed in app config since the entry was last published.
    let documentId = `${cdsDocumentPrefix}-${entryId.toLowerCase()}`;
    if (cma) {
      try {
        const { data } = await getNprCDSData(entryId, locale, {
          cma,
          spaceId,
          environmentId,
        });
        if (data?.cdsDocumentId) documentId = data.cdsDocumentId;
      } catch {
        // fall back to derived id
      }
    }
    const response = await fetch(`${baseUrl}/v1/documents/${documentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cdsAccessToken}` },
    });

    if (!response.ok && response.status !== 404) {
      const responseBody = await response.json().catch(() => null);
      return {
        success: false,
        error: `CDS returned ${response.status}: ${JSON.stringify(responseBody)}`,
      } as DeleteActionResult;
    }

    if (cma) {
      await clearNprCDSData(entryId, locale, {
        cma,
        spaceId,
        environmentId,
      });
    }

    return { success: true } as DeleteActionResult;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message } as DeleteActionResult;
  }
};
