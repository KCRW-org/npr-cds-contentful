import React from "react";
import { Badge, Flex } from "@contentful/f36-components";
import {
  NPR_ONE_LOCAL_COLLECTION_ID,
  NPR_ONE_FEATURED_COLLECTION_ID,
} from "../../lib/publish";

export const COLLECTION_LABELS: Record<string, string> = {
  [NPR_ONE_LOCAL_COLLECTION_ID]: "NPR Local",
  [NPR_ONE_FEATURED_COLLECTION_ID]: "NPR One Featured",
};

export const formatDate = (dateString?: string): string => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const getCollectionBadges = (collections: string[]): React.ReactNode => {
  if (!collections.length) {
    return "—";
  }
  return (
    <Flex gap="spacingXs" flexWrap="wrap">
      {collections.map(collectionId => (
        <Badge key={collectionId} variant="primary">
          {COLLECTION_LABELS[collectionId] || `Collection ${collectionId}`}
        </Badge>
      ))}
    </Flex>
  );
};
