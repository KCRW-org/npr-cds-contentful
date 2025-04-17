import { ResourcesLookupResponse } from "@contentful/node-apps-toolkit";
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
  items = items.map(cleanupLookupItem);

  return {
    items,
    pages: {},
  } as ResourcesLookupResponse;
};
