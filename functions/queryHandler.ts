import type { FunctionEventContext } from "@contentful/node-apps-toolkit";
import { QueryHandler } from "./types";
import { createSchema, createYoga } from "graphql-yoga";
import { fetchCollection, fetchStory } from "../src/lib/fetch";
import { GraphQLError } from "graphql";

const typeDefs = `
type Image {
  url: String!
  altText: String
  urlTemplate: String
  scalable: Boolean
}

type Audio {
  url: String!
  duration: Int
}

type Story {
  id: String!
  urn: String!
  publishDateTime: String
  title: String
  subtitle: String
  description: String
  externalUrl: String
  image: Image
  audio: Audio
}

type Collection {
  id: String!
  urn: String!
  title: String
  subtitle: String
  description: String
  externalUrl: String
  image: Image
  items: [Story]
}

type Query {
  collection(urn: String): Collection
  story(urn: String): Story
}`;

const schema = createSchema({
  typeDefs,
  resolvers: {
    Query: {
      collection: async (_parent, { urn }, context: FunctionEventContext) => {
        if (!urn) {
          return;
        }
        try {
          return await fetchCollection(
            urn,
            context.appInstallationParameters,
            true
          );
        } catch (e) {
          console.log(e);
          throw new GraphQLError(`Error fetching collection ${urn}`);
        }
      },
      story: async (_parent, { urn }, context) => {
        if (!urn) {
          return;
        }
        try {
          return await fetchStory(urn, context.appInstallationParameters);
        } catch (e) {
          console.log(e);
          throw new GraphQLError(`Error fetching story ${urn}`);
        }
      },
    },
  },
});

const yoga = createYoga({ schema, graphiql: false });

export const queryHandler: QueryHandler = async (event, context) => {
  const { query, operationName, variables } = event;
  const body = JSON.stringify({
    query,
    operationName,
    variables,
  });

  const request = {
    body,
    method: "post",
    headers: {
      accept: "application/graphql-response+json",
      "content-type": "application/json",
    },
  };

  /**
   * We take the graphql query from the event and prepare a request for the yoga server.
   * The yoga server will then execute the query using the schema and the resolver we defined above.
   */

  const response = await yoga.fetch(
    "http://this-does-not-matter.com/graphql",
    request,
    context
  );

  return response.json();
};
