import { type StoryLookupResponse } from "../src/types";

export const dummyResource = (
  id: number | string,
  resourceType: string = "story"
) => {
  return {
    id: id.toString(),
    urn: `/v1/${resourceType}/${id}`,
    title: `${resourceType} Title ${id}`,
  };
};

export const dummyStory = (id: number | string) => {
  const resource = dummyResource(id) as StoryLookupResponse;
  resource.subTitle = `Story Sub-Title ${id}`;
  resource.description = `Story teaser text ${id}`;
  resource.publishDateTime = "2025-04-09T12:00:00Z";
  resource.externalUrl = `https://www.example.com/story/${id}`;
  return resource;
};
