import { ResourcesSearchHandler } from "./types";
import { StoryLookupResponse, CollectionQueryResponse } from "../src/types";
import { listStories, listPrograms } from "../src/lib/fetch";
import { cleanupLookupItem } from "../src/lib/utils";

export const searchHandler: ResourcesSearchHandler = async (event, context) => {
  const { query, resourceType } = event;
  console.log(`Search for resources of type ${resourceType}`);
  console.log("Query:\n" + JSON.stringify(query, null, 4));
  let items = [] as Array<StoryLookupResponse | CollectionQueryResponse>;
  const page = event.pages?.nextCursor ?? "1";
  const limit = event.limit ?? 20;
  const pages = {} as Record<string, string>;
  if (resourceType == "NPR:Story") {
    items =
      (await listStories(
        context.appInstallationParameters,
        limit,
        page,
        query
      )) || [];
  } else if (resourceType == "NPR:Collection") {
    items =
      (await listPrograms(context.appInstallationParameters, query)) || [];
  }
  items = items.map(cleanupLookupItem);
  if (items.length >= limit) {
    pages.nextCursor = (page + 1).toString();
  }
  return {
    items,
    pages,
  };
};
