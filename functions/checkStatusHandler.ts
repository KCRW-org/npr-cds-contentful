import type { AppActionHandler } from "./types";
import { NPR_CDS_PROD, NPR_CDS_STAGING } from "../src/lib/utils";

type CheckStatusBody = { entryId: string };
type CheckStatusResult = { published: boolean; collectionIds?: string[] };

export const checkStatusHandler: AppActionHandler = async (event, context) => {
  const body = event.body as CheckStatusBody;
  const { entryId } = body;

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
    return { published: false } as CheckStatusResult;
  }

  const baseUrl =
    cdsEnvironment === "production" ? NPR_CDS_PROD : NPR_CDS_STAGING;

  try {
    const response = await fetch(
      `${baseUrl}/v1/documents/${cdsDocumentPrefix}-${entryId.toLowerCase()}`,
      { headers: { Authorization: `Bearer ${cdsAccessToken}` } }
    );
    if (!response.ok) return { published: false } as CheckStatusResult;
    const body = (await response.json()) as {
      resources?: Array<{
        collections?: Array<{ href?: string }>;
      }>;
    };
    const resource = body.resources?.[0];
    const collectionIds = (resource?.collections ?? [])
      .map(c => c.href?.split("/").pop())
      .filter((id): id is string => Boolean(id));
    return { published: true, collectionIds } as CheckStatusResult;
  } catch {
    return { published: false } as CheckStatusResult;
  }
};
