import React, { useState, useEffect, useCallback, useRef } from "react";
import { SidebarAppSDK } from "@contentful/app-sdk";
import {
  Button,
  Checkbox,
  Flex,
  Note,
  Spinner,
  Text,
} from "@contentful/f36-components";
import { useSDK, useAutoResizer } from "@contentful/react-apps-toolkit";
import {
  NPR_CDS_DATA_FIELD,
  type AppInstallationParameters,
  type NprCDSData,
  type PublishActionResult,
  type DeleteActionResult,
} from "../types";
import { conciergeUrl } from "../lib/cdsLinks";
import {
  NPR_ONE_LOCAL_COLLECTION_ID,
  NPR_ONE_FEATURED_COLLECTION_ID,
} from "../lib/publish";
import { buildAdapter } from "../lib/schema";
import {
  isOutOfDateWithCDS,
  hasUnpublishedChanges as entryHasUnpublishedChanges,
} from "../lib/cdsState";

type PublishState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; error: string };

type DeleteState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; error: string };

type CdsStatus = "checking" | "published" | "unpublished" | "unknown";

const MIN_LOCAL_WORDS = 200;

type RichTextNode = {
  nodeType?: string;
  value?: string;
  content?: RichTextNode[];
};

const formatSidebarError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as { message?: unknown; error?: unknown; status?: unknown };
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
};

const countWords = (body: unknown): number => {
  if (!body || typeof body !== "object") return 0;
  let text = "";
  const walk = (node: RichTextNode) => {
    if (typeof node.value === "string") text += ` ${node.value}`;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(body as RichTextNode);
  return text.trim().split(/\s+/).filter(Boolean).length;
};

const EntrySidebar = () => {
  const sdk = useSDK<SidebarAppSDK>();
  const cma = sdk.cma;
  const params = (sdk.parameters.installation ||
    {}) as AppInstallationParameters;
  const adapter = buildAdapter(params.locale || sdk.locales.default, params);
  const { bodyField: bodyFieldId, audioLinkField: audioFieldId } = adapter;
  const [publishState, setPublishState] = useState<PublishState>({
    status: "idle",
  });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    status: "idle",
  });
  // Seed CDS state synchronously from the entry's nprCDSData field so the
  // linked id and status render immediately, without waiting on checkStatus.
  // checkStatus still runs below to reconcile against authoritative state.
  const initialNprData = sdk.entry.fields[NPR_CDS_DATA_FIELD]?.getValue() as
    | NprCDSData
    | undefined;
  // Only use stored collectionIds as seed when the story is actually linked to
  // a CDS document; otherwise an orphaned `{ collectionIds: [] }` would turn
  // both checkboxes off on first paint.
  const hasPublishHistory = !!initialNprData?.cdsDocumentId;
  const [nprOneLocal, setNprOneLocal] = useState(
    hasPublishHistory
      ? initialNprData?.collectionIds?.includes(NPR_ONE_LOCAL_COLLECTION_ID) ??
          false
      : true
  );
  const [nprOneFeatured, setNprOneFeatured] = useState(
    hasPublishHistory
      ? initialNprData?.collectionIds?.includes(
          NPR_ONE_FEATURED_COLLECTION_ID
        ) ?? false
      : false
  );
  const [cdsStatus, setCdsStatus] = useState<CdsStatus>(
    initialNprData?.cdsDocumentId ? "published" : "checking"
  );
  // The collection checkboxes hold user intent, but `reconcileStatus` overwrites
  // them from authoritative server state. Until the first reconcile resolves we
  // keep the checkboxes disabled so an edit can't be silently clobbered by a
  // slow in-flight status fetch. Re-set to false while a post-action re-fetch
  // is in progress.
  const [statusReady, setStatusReady] = useState(false);
  // Monotonic token so only the latest reconcile is allowed to write state —
  // a stale fetch resolving late can't overwrite a newer one.
  const statusTokenRef = useRef(0);
  // Guards against `setState` after unmount when a reconcile request is still
  // in flight (the token alone still matches on unmount). Reset to true on
  // mount so React strict-mode's mount→unmount→remount doesn't leave it false.
  const isMountedRef = useRef(true);
  const [cdsCollectionIds, setCdsCollectionIds] = useState<string[]>(
    initialNprData?.collectionIds ?? []
  );
  const [cdsDocumentId, setCdsDocumentId] = useState<string | null>(
    initialNprData?.cdsDocumentId ?? null
  );
  const [nprContentfulVersion, setNprContentfulVersion] = useState<
    number | null
  >(initialNprData?.contentfulVersion ?? null);
  const [entrySys, setEntrySys] = useState(() => sdk.entry.getSys());
  const [canPublish, setCanPublish] = useState<boolean | null>(null);
  const [hasPublishedAudio, setHasPublishedAudio] = useState(false);
  const [bodyWordCount, setBodyWordCount] = useState(() =>
    countWords(sdk.entry.fields[bodyFieldId]?.getValue())
  );

  useAutoResizer();

  useEffect(() => {
    return sdk.entry.onSysChanged(setEntrySys);
  }, [sdk.entry]);

  // React to nprCDSData field writes (publish/delete actions update it
  // server-side; the SDK syncs the change back here).
  useEffect(() => {
    const field = sdk.entry.fields[NPR_CDS_DATA_FIELD];
    if (!field) return;
    return field.onValueChanged((value: unknown) => {
      const data = value as NprCDSData | undefined;
      if (data?.cdsDocumentId) {
        setCdsStatus("published");
        setCdsDocumentId(data.cdsDocumentId);
        setCdsCollectionIds(data.collectionIds ?? []);
        setNprContentfulVersion(data.contentfulVersion ?? null);
      } else {
        setCdsStatus("unpublished");
        setCdsDocumentId(null);
        setCdsCollectionIds([]);
        setNprContentfulVersion(null);
      }
    });
  }, [sdk.entry]);

  useEffect(() => {
    let cancelled = false;
    sdk.access
      .can("publish", { sys: entrySys })
      .then(allowed => {
        if (!cancelled) setCanPublish(allowed);
      })
      .catch(() => {
        if (!cancelled) setCanPublish(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk.access, entrySys]);

  useEffect(() => {
    const bodyField = sdk.entry.fields[bodyFieldId];
    if (!bodyField) return;
    return bodyField.onValueChanged((value: unknown) => {
      setBodyWordCount(countWords(value));
    });
  }, [sdk.entry, bodyFieldId]);

  useEffect(() => {
    const audioField = sdk.entry.fields[audioFieldId];
    if (!audioField) {
      setHasPublishedAudio(false);
      return;
    }
    let cancelled = false;
    const check = async (value: unknown) => {
      const link = value as { sys?: { id?: string } } | undefined;
      const id = link?.sys?.id;
      if (!id) {
        if (!cancelled) setHasPublishedAudio(false);
        return;
      }
      try {
        const entry = await cma.entry.get({
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environment,
          entryId: id,
        });
        if (!cancelled) {
          setHasPublishedAudio(entry.sys.publishedVersion != null);
        }
      } catch {
        if (!cancelled) setHasPublishedAudio(false);
      }
    };
    check(audioField.getValue());
    const unsubscribe = audioField.onValueChanged(check);
    // Publish state of the linked audio entry can change via a slide-in
    // overlay without the link value on this entry changing. Re-check when
    // slide-in navigation returns us to the root entry.
    const unsubscribeSlideIn = sdk.navigator.onSlideInNavigation(
      ({ newSlideLevel }) => {
        if (newSlideLevel === 0) check(audioField.getValue());
      }
    );
    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeSlideIn();
    };
  }, [
    sdk.entry,
    sdk.ids.space,
    sdk.ids.environment,
    sdk.navigator,
    cma,
    audioFieldId,
  ]);

  // Fetch authoritative CDS status and reconcile local state against it. Runs
  // on mount and again after a publish/delete so the checkboxes and "needs
  // update" indicator reflect what the server actually stored. Guarded by
  // `statusTokenRef` so a stale call can't clobber a newer one, and toggles
  // `statusReady` so the checkboxes stay disabled while a fetch is in flight.
  const reconcileStatus = useCallback(async () => {
    const token = ++statusTokenRef.current;
    setStatusReady(false);
    try {
      const result = await cma.appActionCall.createWithResponse(
        {
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environment,
          appDefinitionId: sdk.ids.app || "",
          appActionId: "publishToNPR",
        },
        { parameters: { action: "checkStatus", entryId: sdk.ids.entry } }
      );
      if (token !== statusTokenRef.current || !isMountedRef.current) return;
      const body = JSON.parse(result.response.body) as {
        published: boolean;
        collectionIds?: string[];
        contentfulVersion?: number;
        error?: string;
      };
      if (body.error) {
        // Keep any state already seeded from the entry field; only fall back
        // to "unknown" when we had nothing to show.
        setCdsStatus(prev => (prev === "checking" ? "unknown" : prev));
        return;
      }
      setCdsStatus(body.published ? "published" : "unpublished");
      const collectionIds = body.collectionIds ?? [];
      setCdsCollectionIds(collectionIds);
      setNprContentfulVersion(body.contentfulVersion ?? null);
      // cdsDocumentId is owned by the nprCDSData field's onValueChanged
      // subscription above; intentionally not read from the reconcile
      // response so a stale/divergent server reply can't blank the link.
      // If the story is already in NPR CDS, default the checkboxes to the
      // collections it's currently a member of so updates preserve state.
      if (body.published) {
        setNprOneLocal(collectionIds.includes(NPR_ONE_LOCAL_COLLECTION_ID));
        setNprOneFeatured(
          collectionIds.includes(NPR_ONE_FEATURED_COLLECTION_ID)
        );
      }
    } catch {
      if (token !== statusTokenRef.current || !isMountedRef.current) return;
      setCdsStatus(prev => (prev === "checking" ? "unknown" : prev));
    } finally {
      if (token === statusTokenRef.current && isMountedRef.current)
        setStatusReady(true);
    }
  }, [sdk.ids, cma]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    reconcileStatus();
  }, [reconcileStatus]);

  const isPublishedInContentful = entrySys.publishedVersion != null;
  const hasUnpublishedChanges = entryHasUnpublishedChanges(entrySys);
  const needsUpdate =
    cdsStatus === "published" &&
    isOutOfDateWithCDS(entrySys, nprContentfulVersion);
  const hasEnoughBodyWords = bodyWordCount >= MIN_LOCAL_WORDS;
  const qualifiesForLocal = hasEnoughBodyWords || hasPublishedAudio;
  const effectiveNprOneLocal = nprOneLocal && qualifiesForLocal;
  const effectiveNprOneFeatured = nprOneFeatured && hasPublishedAudio;
  const noneSelected = !effectiveNprOneLocal && !effectiveNprOneFeatured;
  const bothDisabled = !qualifiesForLocal;
  const currentlyInLocal = cdsCollectionIds.includes(
    NPR_ONE_LOCAL_COLLECTION_ID
  );
  const currentlyInFeatured = cdsCollectionIds.includes(
    NPR_ONE_FEATURED_COLLECTION_ID
  );
  const willRemoveLocal = currentlyInLocal && !qualifiesForLocal;
  const willRemoveFeatured = currentlyInFeatured && !hasPublishedAudio;
  const collectionsChanged =
    cdsStatus === "published" &&
    (effectiveNprOneLocal !== currentlyInLocal ||
      effectiveNprOneFeatured !== currentlyInFeatured);
  const updateIsNoOp =
    cdsStatus === "published" && !needsUpdate && !collectionsChanged;
  const isBusy =
    publishState.status === "loading" || deleteState.status === "loading";

  const publishLabel =
    cdsStatus === "checking" || !statusReady ? (
      <Flex alignItems="center" gap="spacingXs">
        <Spinner size="small" />
        <Text>Checking NPR status…</Text>
      </Flex>
    ) : cdsStatus === "published" ? (
      "Update Story in NPR CDS"
    ) : (
      "Publish Story to NPR CDS"
    );

  const handlePublish = async () => {
    setDeleteState({ status: "idle" });
    setPublishState({ status: "loading" });
    try {
      const result = await cma.appActionCall.createWithResponse(
        {
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environment,
          appDefinitionId: sdk.ids.app || "",
          appActionId: "publishToNPR",
        },
        {
          parameters: {
            entryId: sdk.ids.entry,
            submitToNprOneLocal: effectiveNprOneLocal,
            submitToNprOneFeatured: effectiveNprOneFeatured,
            environmentAlias: sdk.ids.environmentAlias,
          },
        }
      );
      const body: PublishActionResult = JSON.parse(result.response.body);
      if (body.success && body.documentId) {
        setCdsStatus("published");
        setCdsDocumentId(body.documentId);
        // Re-fetch authoritative state (collections, version) from the server
        // rather than projecting it optimistically, so the checkboxes and
        // "needs update" indicator reflect what was actually stored. We stay in
        // the loading state until this resolves, keeping the controls disabled.
        await reconcileStatus();
        setPublishState({ status: "success" });
      } else {
        setPublishState({
          status: "error",
          error: body.error || "Unknown error publishing to NPR CDS",
        });
      }
    } catch (err: unknown) {
      console.error("[EntrySidebar] publish action call failed", err);
      setPublishState({ status: "error", error: formatSidebarError(err) });
    }
  };

  const handleDelete = async () => {
    setPublishState({ status: "idle" });
    setDeleteState({ status: "loading" });
    try {
      const result = await cma.appActionCall.createWithResponse(
        {
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environment,
          appDefinitionId: sdk.ids.app || "",
          appActionId: "publishToNPR",
        },
        { parameters: { action: "delete", entryId: sdk.ids.entry } }
      );
      const body: DeleteActionResult = JSON.parse(result.response.body);
      if (body.success) {
        setCdsStatus("unpublished");
        setCdsCollectionIds([]);
        setCdsDocumentId(null);
        // Reconcile against the server (the entry's nprCDSData was cleared) so
        // status stays in sync; keeps the controls disabled until it resolves.
        await reconcileStatus();
        setDeleteState({ status: "success" });
      } else {
        setDeleteState({
          status: "error",
          error: body.error || "Unknown error deleting from NPR CDS",
        });
      }
    } catch (err: unknown) {
      console.error("[EntrySidebar] delete action call failed", err);
      setDeleteState({ status: "error", error: formatSidebarError(err) });
    }
  };

  if (canPublish === null) {
    return (
      <Flex alignItems="center" gap="spacingXs">
        <Spinner size="small" />
        <Text>Checking permissions…</Text>
      </Flex>
    );
  }

  if (!canPublish) {
    return (
      <Note variant="neutral">
        You don't have permission to publish this entry to NPR CDS.
      </Note>
    );
  }

  return (
    <Flex
      flexDirection="column"
      gap="spacingS"
      style={{ wordBreak: "break-word" }}
    >
      <Flex flexDirection="column" gap="spacingXs">
        <Checkbox
          isChecked={nprOneLocal && qualifiesForLocal}
          onChange={e => setNprOneLocal(e.target.checked)}
          isDisabled={isBusy || !statusReady || !qualifiesForLocal}
        >
          NPR Local
        </Checkbox>
        {!qualifiesForLocal && (
          <Note variant="neutral">
            NPR Local requires either published audio media or a story body of
            at least {MIN_LOCAL_WORDS} words ({bodyWordCount} so far).
          </Note>
        )}
        {willRemoveLocal && (
          <Note variant="warning">
            This story is currently in NPR Local. Updating will remove it from
            the collection.
          </Note>
        )}
        <Checkbox
          isChecked={nprOneFeatured && hasPublishedAudio}
          onChange={e => setNprOneFeatured(e.target.checked)}
          isDisabled={isBusy || !statusReady || !hasPublishedAudio}
        >
          NPR Featured
        </Checkbox>
        {!hasPublishedAudio && (
          <Note variant="neutral">
            NPR Featured requires published audio media.
          </Note>
        )}
        {willRemoveFeatured && (
          <Note variant="warning">
            This story is currently in NPR Featured. Updating will remove it
            from the collection.
          </Note>
        )}
        {noneSelected && (
          <Note variant="warning">Select at least one collection.</Note>
        )}
      </Flex>

      {!isPublishedInContentful && (
        <Note variant="warning">
          Entry must be published in Contentful before sending to NPR CDS.
        </Note>
      )}

      {isPublishedInContentful && hasUnpublishedChanges && (
        <Note variant="warning">
          Entry has unpublished changes. Publish all changes in Contentful
          before sending to NPR CDS.
        </Note>
      )}

      {needsUpdate && (
        <Note variant="warning">
          This story has been updated in Contentful since the last publish to
          NPR CDS. Click "Update Story in NPR CDS" to sync the latest changes.
        </Note>
      )}

      {cdsStatus === "published" && cdsDocumentId && (
        <Note
          variant={publishState.status === "success" ? "positive" : "neutral"}
          title="NPR CDS document"
        >
          <Text>
            <a
              href={conciergeUrl(cdsDocumentId)}
              target="_blank"
              rel="noreferrer"
              title="Open in NPR Concierge"
            >
              {cdsDocumentId}
            </a>
          </Text>
        </Note>
      )}

      <Button
        variant="primary"
        onClick={handlePublish}
        isDisabled={
          isBusy ||
          !statusReady ||
          noneSelected ||
          bothDisabled ||
          !isPublishedInContentful ||
          hasUnpublishedChanges ||
          cdsStatus === "checking" ||
          updateIsNoOp
        }
        isFullWidth
      >
        {publishState.status === "loading" ? (
          <Flex alignItems="center" gap="spacingXs">
            <Spinner size="small" />
            <Text>
              {cdsStatus === "published" ? "Updating…" : "Publishing…"}
            </Text>
          </Flex>
        ) : (
          publishLabel
        )}
      </Button>

      {publishState.status === "error" && (
        <Note variant="negative" title="Publish failed">
          <Text>{publishState.error}</Text>
        </Note>
      )}

      {cdsStatus === "published" && deleteState.status === "confirming" ? (
        <Flex flexDirection="column" gap="spacingXs">
          <Text fontColor="gray700" fontSize="fontSizeS">
            Remove this story from NPR CDS?
          </Text>
          <Flex gap="spacingXs">
            <Button
              variant="negative"
              size="small"
              onClick={handleDelete}
              isFullWidth
            >
              Delete
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setDeleteState({ status: "idle" })}
              isFullWidth
            >
              Cancel
            </Button>
          </Flex>
        </Flex>
      ) : cdsStatus === "published" ? (
        <Button
          variant="negative"
          onClick={() => setDeleteState({ status: "confirming" })}
          isDisabled={isBusy || deleteState.status === "success"}
          isFullWidth
        >
          {deleteState.status === "loading" ? (
            <Flex alignItems="center" gap="spacingXs">
              <Spinner size="small" />
              <Text>Deleting…</Text>
            </Flex>
          ) : (
            "Remove from NPR CDS"
          )}
        </Button>
      ) : null}

      {deleteState.status === "success" && (
        <Note variant="positive" title="Removed from NPR CDS">
          <Text>The story has been removed from NPR CDS.</Text>
        </Note>
      )}

      {deleteState.status === "error" && (
        <Note variant="negative" title="Delete failed">
          <Text>{deleteState.error}</Text>
        </Note>
      )}
    </Flex>
  );
};

export default EntrySidebar;
