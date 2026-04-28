import React from "react";
import { Table } from "@contentful/f36-components";
import type { PublishedStorySummary } from "../../types";
import { StoryRow } from "./StoryRow";

interface StoriesTableProps {
  stories: PublishedStorySummary[];
  spaceId: string;
  environmentId: string;
  environmentAlias?: string;
  onOpenEntry: (entryId: string) => void;
}

export const StoriesTable: React.FC<StoriesTableProps> = ({
  stories,
  spaceId,
  environmentId,
  environmentAlias,
  onOpenEntry,
}) => {
  const buildEntryHref = (entryId: string): string => {
    return `https://app.contentful.com/spaces/${spaceId}/environments/${
      environmentAlias ?? environmentId
    }/entries/${entryId}`;
  };

  return (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.Cell as="th">Title</Table.Cell>
          <Table.Cell as="th">Status</Table.Cell>
          <Table.Cell as="th">Media</Table.Cell>
          <Table.Cell as="th">Published</Table.Cell>
          <Table.Cell as="th">Collections</Table.Cell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {stories.map(story => (
          <StoryRow
            key={story.entryId}
            story={story}
            entryHref={buildEntryHref(story.entryId)}
            onOpenEntry={onOpenEntry}
          />
        ))}
      </Table.Body>
    </Table>
  );
};
