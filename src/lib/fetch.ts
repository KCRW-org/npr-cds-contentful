import {
  AppInstallationParameters,
  Collection,
  CollectionQueryResponse,
  Story,
  StoryLookupResponse,
} from "../types";
import {
  collectionLookupForCollection,
  fetchByURN,
  idFromURN,
  storyLookupForStory,
  queryCDS,
} from "./utils";

export const fetchStory = async (
  urn: string,
  appParams: AppInstallationParameters
): Promise<StoryLookupResponse | undefined> => {
  const { cdsAccessToken } = appParams;
  if (!cdsAccessToken) {
    return;
  }
  const story = ((await fetchByURN(urn, cdsAccessToken)) as Story[])[0];
  return storyLookupForStory(story);
};

export const fetchStoryById = async (
  id: string,
  appParams: AppInstallationParameters
): Promise<StoryLookupResponse | undefined> => {
  const urn = `/v1/documents/${id}`;
  return await fetchStory(urn, appParams);
};

export const fetchCollection = async (
  urn: string,
  appParams: AppInstallationParameters,
  withItems: boolean = false
): Promise<CollectionQueryResponse | undefined> => {
  const { cdsAccessToken } = appParams;
  if (!cdsAccessToken) {
    return;
  }
  const collection = (
    (await fetchByURN(urn, cdsAccessToken)) as Collection[]
  )[0];
  return await collectionLookupForCollection(
    collection,
    cdsAccessToken,
    withItems
  );
};

export const fetchCollectionById = async (
  id: string,
  appParams: AppInstallationParameters,
  withItems: boolean = false
): Promise<StoryLookupResponse | undefined> => {
  const urn = `/v1/documents/${id}`;
  return await fetchCollection(urn, appParams, withItems);
};

export const fetchMultipleStories = async (
  urns: string[],
  appParams: AppInstallationParameters
): Promise<StoryLookupResponse[] | undefined> => {
  const { cdsAccessToken } = appParams;
  if (!cdsAccessToken) {
    return;
  }
  const ids = (
    urns.map(urn => idFromURN(urn)).filter(id => !!id) as string[]
  ).join(",");
  const query = new URLSearchParams({ ids });
  const stories = await queryCDS(query, cdsAccessToken);
  return stories.map(storyLookupForStory);
};

export const fetchMultipleCollections = async (
  urns: string[],
  appParams: AppInstallationParameters
): Promise<CollectionQueryResponse[] | undefined> => {
  const { cdsAccessToken } = appParams;
  if (!cdsAccessToken) {
    return;
  }
  const ids = (
    urns.map(urn => idFromURN(urn)).filter(id => !!id) as string[]
  ).join(",");
  const query = new URLSearchParams({ ids });
  const collections = await queryCDS(query, cdsAccessToken);
  const results = [];
  for (const collection of collections) {
    results.push(
      await collectionLookupForCollection(collection, cdsAccessToken)
    );
  }
  return results;
};

export const listStories = async (
  appParams: AppInstallationParameters,
  limit: number,
  page: string,
  id?: string
): Promise<StoryLookupResponse[] | undefined> => {
  const { cdsAccessToken } = appParams;
  if (!cdsAccessToken) {
    return;
  }
  const query = new URLSearchParams();
  if (id) {
    query.append("ids", id);
  } else {
    query.append("sort", "editorial");
    query.append("publishDateTime", `...${new Date().toJSON()}`);
    query.append("limit", limit.toString());
  }
  query.append("profileIds", "story");
  const pageNum = +page;
  if (pageNum > 1) {
    query.append("offset", (pageNum * limit).toString());
  }

  const results = await queryCDS(query, cdsAccessToken);
  if (results) {
    return results.map(storyLookupForStory);
  }
  return [];
};

export const listPrograms = async (
  appParams: AppInstallationParameters,
  id?: string
): Promise<CollectionQueryResponse[] | undefined> => {
  const { cdsAccessToken } = appParams;
  if (!cdsAccessToken) {
    return;
  }
  const query = new URLSearchParams();
  if (id) {
    query.append("ids", id);
  } else {
    query.append("limit", "100");
  }
  query.append("profileIds", "program");
  const collections = await queryCDS(query, cdsAccessToken);
  if (!collections) {
    return [];
  }
  const results = [];
  for (const collection of collections) {
    results.push(
      await collectionLookupForCollection(collection, cdsAccessToken)
    );
  }
  results.sort((a, b) => {
    const aTitle = (a.title || a.id).toLowerCase();
    const bTitle = (b.title || b.id).toLowerCase();
    if (aTitle < bTitle) {
      return -1;
    }
    if (aTitle > bTitle) {
      return 1;
    }
    return 0;
  });
  return results;
};
