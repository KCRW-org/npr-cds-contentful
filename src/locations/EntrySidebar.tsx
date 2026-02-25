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
import { useCMA, useSDK } from "@contentful/react-apps-toolkit";
import type { PublishActionResult, DeleteActionResult } from "../types";

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

const EntrySidebar = () => {
  const sdk = useSDK<SidebarAppSDK>();
  const cma = useCMA();
  const [publishState, setPublishState] = useState<PublishState>({
    status: "idle",
  });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    status: "idle",
  });
  const [nprOneLocal, setNprOneLocal] = useState(true);
  const [nprOneFeatured, setNprOneFeatured] = useState(false);
  const [cdsStatus, setCdsStatus] = useState<CdsStatus>("checking");
  const [entrySys, setEntrySys] = useState(() => sdk.entry.getSys());

  useEffect(() => {
    sdk.window.startAutoResizer();
  }, []);

  useEffect(() => {
    return sdk.entry.onSysChanged(setEntrySys);
  }, []);

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
        const body = JSON.parse(result.response.body) as { published: boolean };
        setCdsStatus(body.published ? "published" : "unpublished");
      })
      .catch(() => setCdsStatus("unknown"));
  }, []);

  const isPublishedInContentful = entrySys.publishedVersion != null;
  const noneSelected = !nprOneLocal && !nprOneFeatured;
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
            submitToNprOneLocal: nprOneLocal,
            submitToNprOneFeatured: nprOneFeatured,
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
      } else {
        setPublishState({
          status: "error",
          error: body.error || "Unknown error publishing to NPR CDS",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPublishState({ status: "error", error: message });
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
      } else {
        setDeleteState({
          status: "error",
          error: body.error || "Unknown error deleting from NPR CDS",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDeleteState({ status: "error", error: message });
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
          isChecked={nprOneLocal}
          onChange={e => setNprOneLocal(e.target.checked)}
          isDisabled={isBusy}
        >
          NPR Local
        </Checkbox>
        <Checkbox
          isChecked={nprOneFeatured}
          onChange={e => setNprOneFeatured(e.target.checked)}
          isDisabled={isBusy}
        >
          NPR Featured
        </Checkbox>
        {noneSelected && (
          <Note variant="warning">Select at least one collection.</Note>
        )}
      </Flex>

      {!isPublishedInContentful && (
        <Note variant="warning">
          Entry must be published in Contentful before sending to NPR CDS.
        </Note>
      )}

      <Button
        variant="primary"
        onClick={handlePublish}
        isDisabled={
          isBusy ||
          noneSelected ||
          !isPublishedInContentful ||
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
