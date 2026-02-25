import { EventHandler, MappingHandler } from "./types";
import { lookupHandler } from "./lookupHandler";
import { searchHandler } from "./searchHandler";
import { queryHandler } from "./queryHandler";
import { publishHandler } from "./publishHandler";
import { deleteHandler } from "./deleteHandler";
import { checkStatusHandler } from "./checkStatusHandler";

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
    ...(
      typeMappings as Record<
        string,
        { graphQLOutputType: string; graphQLQueryField: string }
      >
    )[resourceTypeId],
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

  if (event.type === "appaction.call") {
    const action = (event.body as { action?: string }).action;
    if (action === "checkStatus") {
      return checkStatusHandler(event, context);
    }
    if (action === "delete") {
      return deleteHandler(event, context);
    }
    return publishHandler(event, context);
  }

  throw new Error("Bad Request: Unknown Event");
};
