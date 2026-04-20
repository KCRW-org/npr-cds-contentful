import React, { useState, useEffect } from "react";
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
import type {
  AppInstallationParameters,
  PublishActionResult,
  DeleteActionResult,
} from "../types";
import {
  NPR_ONE_LOCAL_COLLECTION_ID,
  NPR_ONE_FEATURED_COLLECTION_ID,
} from "../lib/publish";
import { buildAdapter } from "../lib/schema";

type PublishState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; documentId: string; documentUrl: string }
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
  const [nprOneLocal, setNprOneLocal] = useState(true);
  const [nprOneFeatured, setNprOneFeatured] = useState(false);
  const [cdsStatus, setCdsStatus] = useState<CdsStatus>("checking");
  const [cdsCollectionIds, setCdsCollectionIds] = useState<string[]>([]);
  const [entrySys, setEntrySys] = useState(() => sdk.entry.getSys());
  const [hasPublishedAudio, setHasPublishedAudio] = useState(false);
  const [bodyWordCount, setBodyWordCount] = useState(() =>
    countWords(sdk.entry.fields[bodyFieldId]?.getValue())
  );

  useAutoResizer();

  useEffect(() => {
    return sdk.entry.onSysChanged(setEntrySys);
  }, [sdk.entry]);

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

  useEffect(() => {
    cma.appActionCall
      .createWithResponse(
        {
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environment,
          appDefinitionId: sdk.ids.app || "",
          appActionId: "publishToNPR",
        },
        { parameters: { action: "checkStatus", entryId: sdk.ids.entry } }
      )
      .then(result => {
        const body = JSON.parse(result.response.body) as {
          published: boolean;
          collectionIds?: string[];
        };
        setCdsStatus(body.published ? "published" : "unpublished");
        setCdsCollectionIds(body.collectionIds ?? []);
      })
      .catch(() => setCdsStatus("unknown"));
  }, [sdk.ids, cma]);

  const isPublishedInContentful = entrySys.publishedVersion != null;
  const hasUnpublishedChanges =
    entrySys.publishedVersion != null &&
    entrySys.version > entrySys.publishedVersion + 1;
  const hasEnoughBodyWords = bodyWordCount >= MIN_LOCAL_WORDS;
  const effectiveNprOneLocal = nprOneLocal && hasEnoughBodyWords;
  const effectiveNprOneFeatured = nprOneFeatured && hasPublishedAudio;
  const noneSelected = !effectiveNprOneLocal && !effectiveNprOneFeatured;
  const bothDisabled = !hasEnoughBodyWords && !hasPublishedAudio;
  const currentlyInLocal = cdsCollectionIds.includes(
    NPR_ONE_LOCAL_COLLECTION_ID
  );
  const currentlyInFeatured = cdsCollectionIds.includes(
    NPR_ONE_FEATURED_COLLECTION_ID
  );
  const willRemoveLocal = currentlyInLocal && !hasEnoughBodyWords;
  const willRemoveFeatured = currentlyInFeatured && !hasPublishedAudio;
  const isBusy =
    publishState.status === "loading" || deleteState.status === "loading";

  const publishLabel =
    cdsStatus === "checking" ? (
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
      if (body.success && body.documentId && body.documentUrl) {
        setPublishState({
          status: "success",
          documentId: body.documentId,
          documentUrl: body.documentUrl,
        });
        setCdsStatus("published");
        const newCollectionIds: string[] = [];
        if (effectiveNprOneLocal)
          newCollectionIds.push(NPR_ONE_LOCAL_COLLECTION_ID);
        if (effectiveNprOneFeatured)
          newCollectionIds.push(NPR_ONE_FEATURED_COLLECTION_ID);
        setCdsCollectionIds(newCollectionIds);
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
        setDeleteState({ status: "success" });
        setCdsStatus("unpublished");
        setCdsCollectionIds([]);
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

  return (
    <Flex
      flexDirection="column"
      gap="spacingS"
      style={{ wordBreak: "break-word" }}
    >
      <Flex flexDirection="column" gap="spacingXs">
        <Checkbox
          isChecked={nprOneLocal && hasEnoughBodyWords}
          onChange={e => setNprOneLocal(e.target.checked)}
          isDisabled={isBusy || !hasEnoughBodyWords}
        >
          NPR Local
        </Checkbox>
        {!hasEnoughBodyWords && (
          <Note variant="neutral">
            NPR Local requires a story body of at least {MIN_LOCAL_WORDS} words
            ({bodyWordCount} so far).
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
          isDisabled={isBusy || !hasPublishedAudio}
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

      <Button
        variant="primary"
        onClick={handlePublish}
        isDisabled={
          isBusy ||
          noneSelected ||
          bothDisabled ||
          !isPublishedInContentful ||
          hasUnpublishedChanges ||
          cdsStatus === "checking"
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

      {publishState.status === "success" && (
        <Note variant="positive" title="Published to NPR CDS">
          <Text>
            Document ID:{" "}
            <a href={publishState.documentUrl} target="_blank" rel="noreferrer">
              {publishState.documentId}
            </a>
          </Text>
        </Note>
      )}

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
