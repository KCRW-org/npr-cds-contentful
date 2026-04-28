import { createClient } from "contentful-management";
import type { AppActionParameterDefinition } from "contentful-management";
import {
  organizationId,
  appDefinitionId,
  accessToken,
  contentfulHost,
  manifest,
} from "./imports";

const host = contentfulHost || "api.contentful.com";
const client = createClient({ accessToken, host }, { type: "plain" });

const functionId = manifest.functions[0].id;

const main = async () => {
  const parameters: AppActionParameterDefinition[] = [
    {
      id: "entryId",
      name: "Entry ID",
      description: "The Contentful entry ID of the story to publish",
      type: "Symbol",
      required: false,
    },
    {
      id: "action",
      name: "Action",
      description:
        "Optional action discriminator: 'checkStatus' or 'delete'. Omit for publish/update.",
      type: "Symbol",
      required: false,
    },
    {
      id: "submitToNprOneLocal",
      name: "Submit to NPR One Local",
      description: "Whether to add the story to the NPR One Local collection",
      type: "Boolean",
      required: false,
    },
    {
      id: "submitToNprOneFeatured",
      name: "Submit to NPR One Featured",
      description:
        "Whether to add the story to the NPR One Featured collection",
      type: "Boolean",
      required: false,
    },
    {
      id: "environmentAlias",
      name: "Environment Alias",
      description:
        "Contentful environment alias (e.g. 'master'), used when reading via the CDA",
      type: "Symbol",
      required: false,
    },
  ];

  const payload = {
    type: "function-invocation" as const,
    function: {
      sys: {
        type: "Link" as const,
        linkType: "Function" as const,
        id: functionId,
      },
    },
    category: "Custom" as const,
    name: "Publish to NPR CDS",
    description:
      "Publishes, updates, or removes this story in the NPR Content Distribution Service.",
    parameters,
  };

  const appActionId = "publishToNPR";
  let result;
  try {
    result = await client.appAction.update(
      { organizationId, appDefinitionId, appActionId },
      payload
    );
    console.log("App action updated:");
  } catch (err) {
    const e = err as {
      status?: number;
      statusCode?: number;
      name?: string;
      message?: string;
    };
    const status = e.status ?? e.statusCode;
    const isNotFound =
      status === 404 ||
      e.name === "NotFound" ||
      /"status":\s*404/.test(e.message ?? "");
    if (!isNotFound) throw err;
    result = await client.appAction.create(
      { organizationId, appDefinitionId },
      { id: appActionId, ...payload }
    );
    console.log("App action created:");
  }
  console.dir(result, { depth: 5 });
};

main().catch(err => {
  console.error("Failed to create app action:", err);
  process.exit(1);
});
