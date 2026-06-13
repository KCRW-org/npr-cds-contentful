import { ResourcesLookupHandler } from "./types";
import { CollectionQueryResponse, StoryLookupResponse } from "../src/types";
import {
  fetchMultipleStories,
  fetchMultipleCollections,
} from "../src/lib/fetch";
import { cleanupLookupItem } from "../src/lib/utils";

export const lookupHandler: ResourcesLookupHandler = async (event, context) => {
  const { resourceType } = event;
  const { urns } = event.lookupBy;
  console.log(`Search for resources of type ${resourceType}`);
  console.log("Lookup:\n" + JSON.stringify(urns, null, 4));

  let items = [] as Array<CollectionQueryResponse | StoryLookupResponse>;
  try {
    if (resourceType === "NPR:Story") {
      items =
        (await fetchMultipleStories(
          urns as string[],
          context.appInstallationParameters
        )) || [];
    } else if (resourceType === "NPR:Collection") {
      items =
        (await fetchMultipleCollections(
          urns as string[],
          context.appInstallationParameters
        )) || [];
    }
  } catch (e) {
    // A thrown error here surfaces only as a generic failure in the
    // reference-field UI, so log the detail for diagnosis and return an empty
    // result instead.
    console.error(`[lookupHandler] CDS lookup failed for ${resourceType}:`, e);
    return { items: [], pages: {} };
  }
  items = items.map(cleanupLookupItem);

  return {
    items,
    pages: {},
  };
};
