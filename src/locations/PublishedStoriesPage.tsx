import React, { useEffect, useRef, useState } from "react";
import {
  Heading,
  Flex,
  Spinner,
  Note,
  Button,
} from "@contentful/f36-components";
import { useSDK } from "@contentful/react-apps-toolkit";
import { PageAppSDK } from "@contentful/app-sdk";
import type { EntryProps } from "contentful-management";
import {
  NPR_CDS_DATA_FIELD,
  type AppInstallationParameters,
  type CollectionFilter,
  type NprCDSData,
  type PublishedStorySummary,
  type SortOption,
} from "../types";
import { buildAdapter } from "../lib/schema";
import {
  NPR_ONE_LOCAL_COLLECTION_ID,
  NPR_ONE_FEATURED_COLLECTION_ID,
} from "../lib/publish";
import { isOutOfDateWithCDS, hasUnpublishedChanges } from "../lib/cdsState";
import { FilterControls } from "./PublishedStories/FilterControls";
import { SortControls } from "./PublishedStories/SortControls";
import { StoriesTable } from "./PublishedStories/StoriesTable";
import { LoadMore } from "./PublishedStories/LoadMore";

const BATCH_SIZE = 25;

const entryToSummary = (
  entry: EntryProps,
  locale: string,
  titleField: string,
  publishDateField: string,
  audioLinkField: string
): PublishedStorySummary => {
  const fields = entry.fields as Record<string, Record<string, unknown>>;
  const nprCDSData = fields[NPR_CDS_DATA_FIELD]?.[locale] as
    | NprCDSData
    | undefined;
  const title = (fields[titleField]?.[locale] as string | undefined) ?? "";
  const publishDateTime = fields[publishDateField]?.[locale] as
    | string
    | undefined;

  return {
    id: nprCDSData?.cdsDocumentId ?? entry.sys.id,
    entryId: entry.sys.id,
    title,
    publishDateTime,
    collections: nprCDSData?.collectionIds ?? [],
    hasAudio: !!fields[audioLinkField]?.[locale],
    needsUpdate: isOutOfDateWithCDS(entry.sys, nprCDSData?.contentfulVersion),
    hasDraft: hasUnpublishedChanges(entry.sys),
  };
};

const PublishedStoriesPage = () => {
  const sdk = useSDK<PageAppSDK>();
  const cma = sdk.cma;
  const appParams = sdk.parameters.installation as AppInstallationParameters;
  const isConfigured = !!appParams.cdsAccessToken && !!appParams.nprServiceId;
  const [canPublish, setCanPublish] = useState<boolean | undefined>();
  const [stories, setStories] = useState<PublishedStorySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(isConfigured);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [sort, setSort] = useState<SortOption>("publishDate");
  const [refreshNonce, setRefreshNonce] = useState(0);
  // skipRequest is the offset to fetch next; bumped via Load More.
  const [skipRequest, setSkipRequest] = useState(0);
  const requestTokenRef = useRef(0);

  const handleFilterChange = (next: CollectionFilter) => {
    if (next === filter) return;
    setFilter(next);
  };

  const handleSortChange = (next: SortOption) => {
    if (next === sort) return;
    // Sort change requires a refetch from skip=0 (server returns a different
    // ordering). Don't clear `stories` — leave the previous list visible while
    // the new batch loads, then the effect replaces it. Avoids a flash of the
    // "No stories" empty state mid-transition.
    setSort(next);
    setSkipRequest(0);
  };

  const handleRefresh = () => {
    setSkipRequest(0);
    setRefreshNonce(prev => prev + 1);
  };

  const handleLoadMore = () => {
    setSkipRequest(stories.length);
  };

  useEffect(() => {
    let cancelled = false;
    sdk.access
      .can("publish", "Entry")
      .then(allowed => {
        if (!cancelled) setCanPublish(allowed);
      })
      .catch(() => {
        if (!cancelled) setCanPublish(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk.access]);

  useEffect(() => {
    if (!isConfigured || !canPublish) return;
    const token = ++requestTokenRef.current;
    const fetchStories = async () => {
      setLoading(true);
      try {
        const locale = sdk.parameters.installation?.locale ?? "en-US";
        const adapter = buildAdapter(locale, appParams);
        const orderField =
          sort === "updatedAt"
            ? "sys.updatedAt"
            : `fields.${adapter.publishDateField}`;

        const result = await cma.entry.getMany({
          query: {
            content_type: adapter.contentTypeId,
            [`fields.${NPR_CDS_DATA_FIELD}[exists]`]: true,
            order: `-${orderField}`,
            limit: BATCH_SIZE,
            skip: skipRequest,
          },
        });

        if (token !== requestTokenRef.current) return;

        const entries = (result.items ?? []) as EntryProps[];
        const batch = entries.map(e =>
          entryToSummary(
            e,
            locale,
            adapter.titleField,
            adapter.publishDateField,
            adapter.audioLinkField
          )
        );

        setStories(prev => (skipRequest === 0 ? batch : [...prev, ...batch]));
        setTotal(result.total ?? 0);
        setError(undefined);
        setHasFetchedOnce(true);
      } catch (err) {
        if (token !== requestTokenRef.current) return;
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to load published stories";
        setError(errorMsg);
        if (skipRequest === 0) setStories([]);
      } finally {
        if (token === requestTokenRef.current) setLoading(false);
      }
    };

    fetchStories();
  }, [
    sort,
    skipRequest,
    isConfigured,
    canPublish,
    sdk.ids.space,
    sdk.ids.environment,
    refreshNonce,
  ]);

  if (canPublish === undefined) {
    return (
      <Flex flexDirection="column" margin="spacingL" gap="spacingM">
        <Heading>Published Stories</Heading>
        <Flex justifyContent="center" padding="spacingL">
          <Spinner />
        </Flex>
      </Flex>
    );
  }

  if (!canPublish) {
    return (
      <Flex flexDirection="column" margin="spacingL" gap="spacingM">
        <Heading>Published Stories</Heading>
        <Note variant="warning" title="Access denied">
          You need publish permissions to view stories published to NPR CDS.
        </Note>
      </Flex>
    );
  }

  if (!isConfigured) {
    return (
      <Flex flexDirection="column" margin="spacingL" gap="spacingM">
        <Heading>Published Stories</Heading>
        <Note variant="warning" title="App not configured">
          Set the NPR CDS access token and NPR Service ID in the app
          configuration to view published stories.
        </Note>
      </Flex>
    );
  }

  const showFullSpinner = loading && !hasFetchedOnce;
  const showInlineSpinner = loading && hasFetchedOnce;
  const collectionFilterValue =
    filter === "local"
      ? NPR_ONE_LOCAL_COLLECTION_ID
      : filter === "featured"
        ? NPR_ONE_FEATURED_COLLECTION_ID
        : undefined;
  const visibleStories = collectionFilterValue
    ? stories.filter(s => s.collections.includes(collectionFilterValue))
    : stories;
  const hasMore = stories.length < total;

  return (
    <Flex flexDirection="column" margin="spacingL" gap="spacingM">
      <Flex alignItems="center" gap="spacingS">
        <Heading marginBottom="none">Published Stories</Heading>
        {showInlineSpinner && <Spinner size="small" />}
        <Button
          size="small"
          variant="secondary"
          onClick={handleRefresh}
          isDisabled={loading}
        >
          Refresh
        </Button>
      </Flex>
      <Flex
        gap="spacingXl"
        flexWrap="wrap"
        justifyContent="space-between"
        alignItems="center"
      >
        <FilterControls filter={filter} onChange={handleFilterChange} />
        <SortControls sort={sort} onChange={handleSortChange} />
      </Flex>
      {showFullSpinner ? (
        <Flex justifyContent="center" padding="spacingL">
          <Spinner />
        </Flex>
      ) : visibleStories.length === 0 ? (
        error ? (
          <Note variant="negative" title="Error">
            {error}
          </Note>
        ) : (
          <Note variant="neutral" title="No stories">
            {filter === "all"
              ? "No stories have been published to NPR CDS yet. Open a story entry and use the NPR sidebar to publish your first one."
              : hasMore
                ? `No loaded stories match this filter yet. Click "Load more" to keep looking, or switch to "All".`
                : `No stories in this collection. Switch to "All" to see other published stories, or publish a story to ${filter === "local" ? "NPR Local" : "NPR One Featured"} from a story entry.`}
          </Note>
        )
      ) : (
        <>
          {error && (
            <Note variant="negative" title="Error">
              {error}
            </Note>
          )}
          <StoriesTable
            stories={visibleStories}
            spaceId={sdk.ids.space}
            environmentId={sdk.ids.environment}
            environmentAlias={sdk.ids.environmentAlias}
            onOpenEntry={entryId =>
              sdk.navigator.openEntry(entryId, { slideIn: true })
            }
          />
        </>
      )}
      {hasFetchedOnce && total > 0 && (
        <LoadMore
          loaded={stories.length}
          total={total}
          hasMore={hasMore}
          isLoading={loading}
          onLoadMore={handleLoadMore}
        />
      )}
    </Flex>
  );
};

export default PublishedStoriesPage;
