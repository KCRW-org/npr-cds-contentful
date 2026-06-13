/**
 * Updates the app definition with settings not covered by
 * `create-app-definition` / `upload` — currently the installation parameter
 * definitions, which mark the NPR CDS token and the Contentful Delivery API
 * token as type "Secret".
 *
 * Secret parameters are write-only outside the app backend: the raw values are
 * delivered only to the app's functions (`context.appInstallationParameters`);
 * the App SDK and the CMA see them redacted as a same-length string of `*`.
 * Re-saving that redacted placeholder preserves the stored value, which is how
 * the config screen leaves an unchanged token alone.
 *
 * NOTE: once `parameters.installation` is defined, the installation parameter
 * schema is closed — Contentful rejects installation saves containing any key
 * not declared below with a 422 ("The property X is not expected"), so EVERY
 * installation parameter must be declared here, not just the secrets.
 * (Verified empirically 2026-06: with a definition declaring only the secrets,
 * any subsequent config-screen save fails.) Keep this list in sync with
 * `AppInstallationParameters` in src/types.ts and `KNOWN_PARAM_IDS` in
 * src/locations/ConfigScreen.tsx.
 *
 * Usage: npm run update-app-definition[:dev]
 * Re-run whenever the parameter schema changes; the update is idempotent.
 */
import { createClient } from "contentful-management";
import type { AppDefinitionProps } from "contentful-management";
import {
  organizationId,
  appDefinitionId,
  accessToken,
  contentfulHost,
} from "./imports";

type InstallationParameterDefinition = NonNullable<
  NonNullable<AppDefinitionProps["parameters"]>["installation"]
>[number];

const host = contentfulHost || "api.contentful.com";
const client = createClient({ accessToken, host }, { type: "plain" });

const installation: InstallationParameterDefinition[] = [
  {
    id: "cdsAccessToken",
    name: "NPR CDS API token",
    description: "NPR CDS bearer token with write access",
    type: "Secret",
    required: true,
  },
  {
    id: "cdaToken",
    name: "Contentful Delivery API token",
    description:
      "CDA token used to read published content when building CDS documents",
    type: "Secret",
  },
  {
    id: "nprServiceId",
    name: "NPR Service ID",
    description:
      "NPR Organization Service ID, sets owners/brandings on CDS documents",
    type: "Symbol",
  },
  {
    id: "cdsEnvironment",
    name: "CDS Environment",
    description: "NPR CDS environment to publish to (defaults to staging)",
    type: "Enum",
    options: ["production", "staging"],
  },
  {
    id: "cdsDocumentPrefix",
    name: "CDS Document Prefix",
    description: 'Prefix for CDS document IDs (defaults to "contentful-cds")',
    type: "Symbol",
  },
  {
    id: "canonicalUrlTemplate",
    name: "Canonical URL Template",
    description: "URL template with {slug} / {parentSlug} placeholders",
    type: "Symbol",
  },
  {
    id: "audioEmbedUrlTemplate",
    name: "Audio Embed URL Template",
    description: "Embed player URL template for the primary audio asset",
    type: "Symbol",
  },
  {
    id: "locale",
    name: "Locale",
    description: "Contentful locale to read fields from",
    type: "Symbol",
    default: "en-US",
  },
  {
    id: "recommendUntilDays",
    name: "Recommend Until (days)",
    description: "Days after the publish date to recommend in NPR One",
    type: "Number",
  },
  {
    id: "cdaIncludeDepth",
    name: "CDA Include Depth",
    description: "CDA include depth used when fetching the story entry",
    type: "Number",
  },
  {
    id: "enableLayout",
    name: "Include story body layout",
    description: "Build the CDS layout array from the Rich Text body",
    type: "Boolean",
  },
];

const main = async () => {
  const definition = await client.appDefinition.get({
    organizationId,
    appDefinitionId,
  });

  const result = await client.appDefinition.update(
    { organizationId, appDefinitionId },
    {
      ...definition,
      parameters: {
        ...(definition.parameters?.instance
          ? { instance: definition.parameters.instance }
          : {}),
        installation,
      },
    }
  );

  console.log(
    `App definition "${result.name}" updated with ${
      result.parameters?.installation?.length ?? 0
    } installation parameter definitions:`
  );
  for (const param of result.parameters?.installation ?? []) {
    console.log(`  - ${param.id} (${param.type})`);
  }
};

main().catch(err => {
  console.error("Failed to update app definition:", err);
  process.exit(1);
});
