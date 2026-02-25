import { createClient } from "contentful-management";
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
  const result = await client.appAction.create(
    { organizationId, appDefinitionId },
    {
      id: "publishToNPR",
      type: "function-invocation",
      function: {
        sys: {
          type: "Link",
          linkType: "Function",
          id: functionId,
        },
      },
      category: "Custom",
      name: "Publish to NPR CDS",
      description:
        "Publishes, updates, or removes this story in the NPR Content Distribution Service.",
      parameters: [
        {
          id: "entryId",
          name: "Entry ID",
          description: "The Contentful entry ID of the story to publish",
          type: "Symbol",
          required: true,
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
          description:
            "Whether to add the story to the NPR One Local collection",
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
      ],
    }
  );
  console.log("App action created:");
  console.dir(result, { depth: 5 });
};

main().catch(err => {
  console.error("Failed to create app action:", err);
  process.exit(1);
});
