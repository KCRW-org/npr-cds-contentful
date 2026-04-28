import React from "react";
import { Table, Badge, Flex } from "@contentful/f36-components";
import type { PublishedStorySummary } from "../../types";
import { formatDate, getCollectionBadges } from "./helpers";

interface StoryRowProps {
  story: PublishedStorySummary;
  entryHref: string;
  onOpenEntry: (entryId: string) => void;
}

export const StoryRow: React.FC<StoryRowProps> = ({
  story,
  entryHref,
  onOpenEntry,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let cmd/ctrl/middle-click fall through to the default new-tab behavior.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpenEntry(story.entryId);
  };
  const showStatus = story.needsUpdate || story.hasDraft;
  return (
    <Table.Row>
      <Table.Cell>
        <a
          href={entryHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
        >
          {story.title || "(Untitled)"}
        </a>
      </Table.Cell>
      <Table.Cell>
        {showStatus ? (
          <Flex gap="spacingXs" flexWrap="wrap">
            {story.needsUpdate && <Badge variant="warning">Needs update</Badge>}
            {story.hasDraft && <Badge variant="primary">Changed</Badge>}
          </Flex>
        ) : (
          "—"
        )}
      </Table.Cell>
      <Table.Cell>
        {story.hasAudio ? <Badge variant="positive">Audio</Badge> : "—"}
      </Table.Cell>
      <Table.Cell>{formatDate(story.publishDateTime)}</Table.Cell>
      <Table.Cell>{getCollectionBadges(story.collections)}</Table.Cell>
    </Table.Row>
  );
};
