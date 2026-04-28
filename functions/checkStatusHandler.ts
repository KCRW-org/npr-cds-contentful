import type { AppActionHandler } from "./types";
import { getNprCDSData } from "./nprCDSDataStore";

type CheckStatusBody = { entryId: string };
type CheckStatusResult = {
  published: boolean;
  collectionIds?: string[];
  contentfulVersion?: number;
  error?: string;
};

export const checkStatusHandler: AppActionHandler = async (event, context) => {
  const body = event.body as CheckStatusBody;
  const { entryId } = body;

  const { cma, spaceId, environmentId } = context;
  if (!cma) {
    return {
      published: false,
      error: "CMA client not available in function context",
    } as CheckStatusResult;
  }

  const { locale = "en-US" } = context.appInstallationParameters as {
    locale?: string;
  };

  try {
    const { data: nprCDSData } = await getNprCDSData(entryId, locale, {
      cma,
      spaceId,
      environmentId,
    });

    if (!nprCDSData) {
      return { published: false } as CheckStatusResult;
    }

    return {
      published: true,
      collectionIds: nprCDSData.collectionIds,
      contentfulVersion: nprCDSData.contentfulVersion,
    } as CheckStatusResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { published: false, error: message } as CheckStatusResult;
  }
};
