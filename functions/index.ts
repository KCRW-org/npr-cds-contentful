import { EventHandler, MappingHandler } from "./types";
import { lookupHandler } from "./lookupHandler";
import { searchHandler } from "./searchHandler";
import { queryHandler } from "./queryHandler";

const typeMappings = {
  "NPR:Story": {
    graphQLOutputType: "Story",
    graphQLQueryField: "story",
  },
  "NPR:Collection": {
    graphQLOutputType: "Collection",
    graphQLQueryField: "collection",
  },
};

const resourceTypeMappingHandler: MappingHandler = event => {
  const mappings = event.resourceTypes.map(({ resourceTypeId }) => ({
    resourceTypeId,
    graphQLQueryArguments: { urn: "/urn" },
    ...typeMappings[resourceTypeId],
  }));

  return {
    resourceTypes: mappings,
  };
};

export const handler: EventHandler = (event, context) => {
  if (event.type === "resources.search") {
    return searchHandler(event, context);
  }

  if (event.type === "resources.lookup") {
    return lookupHandler(event, context);
  }

  if (event.type === "graphql.resourcetype.mapping") {
    return resourceTypeMappingHandler(event, context);
  }

  if (event.type === "graphql.query") {
    return queryHandler(event, context);
  }

  throw new Error("Bad Request: Unknown Event");
};
