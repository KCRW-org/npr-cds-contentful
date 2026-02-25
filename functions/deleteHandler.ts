import type { AppActionHandler } from "./types";
import type { DeleteActionBody, DeleteActionResult } from "../src/types";
import { NPR_CDS_PROD, NPR_CDS_STAGING } from "../src/lib/utils";

export const deleteHandler: AppActionHandler = async (event, context) => {
  const body = event.body as DeleteActionBody;
  const { entryId } = body;

  try {
    const {
      cdsAccessToken,
      cdsEnvironment,
      cdsDocumentPrefix = "contentful-cds",
    } = context.appInstallationParameters as {
      cdsAccessToken?: string;
      cdsEnvironment?: string;
      cdsDocumentPrefix?: string;
    };

    if (!cdsAccessToken) {
      return {
        success: false,
        error: "Missing CDS access token in app configuration",
      } as DeleteActionResult;
    }

    const baseUrl =
      cdsEnvironment === "production" ? NPR_CDS_PROD : NPR_CDS_STAGING;

    const documentId = `${cdsDocumentPrefix}-${entryId.toLowerCase()}`;
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

    return { success: true } as DeleteActionResult;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message } as DeleteActionResult;
  }
};
