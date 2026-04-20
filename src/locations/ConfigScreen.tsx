import React, { useCallback, useState, useEffect } from "react";
import { ConfigAppSDK } from "@contentful/app-sdk";
import {
  Heading,
  Form,
  Flex,
  Note,
  TextInput,
  FormControl,
  Select,
  Checkbox,
} from "@contentful/f36-components";
import { useSDK } from "@contentful/react-apps-toolkit";
import { AppInstallationParameters } from "../types";

const ConfigScreen = () => {
  const [parameters, setParameters] = useState<AppInstallationParameters>({});
  const sdk = useSDK<ConfigAppSDK>();

  const onConfigure = useCallback(async () => {
    const currentState = await sdk.app.getCurrentState();
    const normalized: AppInstallationParameters = { ...parameters };
    if (!normalized.cdsDocumentPrefix?.trim()) {
      delete normalized.cdsDocumentPrefix;
    }
    if (!normalized.locale?.trim()) {
      sdk.notifier.error("Locale is required.");
      return false;
    }
    normalized.locale = normalized.locale.trim();
    if (
      normalized.recommendUntilDays != null &&
      !Number.isFinite(normalized.recommendUntilDays)
    ) {
      delete normalized.recommendUntilDays;
    }
    if (
      normalized.cdaIncludeDepth != null &&
      !Number.isFinite(normalized.cdaIncludeDepth)
    ) {
      delete normalized.cdaIncludeDepth;
    }
    return {
      parameters: normalized,
      targetState: currentState,
    };
  }, [parameters, sdk]);

  function updateParameters<T extends keyof AppInstallationParameters>(
    parameterName: T
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setParameters({ ...parameters, [parameterName]: value });
    };
  }

  useEffect(() => {
    sdk.app.onConfigure(onConfigure);
  }, [sdk, onConfigure]);

  useEffect(() => {
    (async () => {
      const currentParameters: AppInstallationParameters | null =
        await sdk.app.getParameters();

      if (currentParameters) {
        setParameters(currentParameters);
      }

      sdk.app.setReady();
    })();
  }, [sdk]);

  return (
    <Flex flexDirection="column" margin="spacingL">
      <Heading>App Config</Heading>
      <Form>
        <FormControl isRequired isInvalid={!parameters.cdsAccessToken}>
          <FormControl.Label>API token</FormControl.Label>
          <TextInput
            value={parameters.cdsAccessToken || ""}
            name="cdsAccessToken"
            onChange={updateParameters("cdsAccessToken")}
          />
          <FormControl.HelpText>
            NPR CDS API token with write access.
          </FormControl.HelpText>
          {!parameters.cdsAccessToken && (
            <FormControl.ValidationMessage>
              Please provide a valid NPR CDS API token.
            </FormControl.ValidationMessage>
          )}
        </FormControl>
        <FormControl>
          <FormControl.Label>Contentful Delivery API Token</FormControl.Label>
          <TextInput
            value={parameters.cdaToken || ""}
            name="cdaToken"
            onChange={updateParameters("cdaToken")}
          />
          <FormControl.HelpText>
            Contentful Content Delivery API (CDA) token. Only published content
            is read through this token when building CDS documents, preventing
            draft changes from leaking to NPR. Required to publish stories.
          </FormControl.HelpText>
        </FormControl>
        <FormControl>
          <FormControl.Label>NPR Service ID</FormControl.Label>
          <TextInput
            value={parameters.nprServiceId || ""}
            name="nprServiceId"
            onChange={updateParameters("nprServiceId")}
          />
          <FormControl.HelpText>
            Your NPR Organization Service ID, used to set owners and brandings
            on published CDS documents (e.g. for NPR One eligibility).
          </FormControl.HelpText>
        </FormControl>
        <FormControl>
          <FormControl.Label>CDS Environment</FormControl.Label>
          <Select
            value={parameters.cdsEnvironment || "staging"}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setParameters({
                ...parameters,
                cdsEnvironment: e.target.value as "production" | "staging",
              })
            }
          >
            <Select.Option value="staging">Staging</Select.Option>
            <Select.Option value="production">Production</Select.Option>
          </Select>
          <FormControl.HelpText>
            Choose whether to publish to the NPR CDS production or staging
            environment.
          </FormControl.HelpText>
        </FormControl>
        <FormControl>
          <FormControl.Label>CDS Document Prefix</FormControl.Label>
          <Note
            variant="warning"
            style={{ marginTop: "8px", marginBottom: "16px" }}
          >
            Changing this prefix on a site with existing CDS documents will
            cause stories to be re-published under new IDs. The old documents
            will remain in CDS and must be deleted manually.
          </Note>
          <TextInput
            value={parameters.cdsDocumentPrefix || ""}
            name="cdsDocumentPrefix"
            onChange={updateParameters("cdsDocumentPrefix")}
            placeholder="contentful-cds"
          />
          <FormControl.HelpText>
            Prefix used when constructing CDS document IDs (e.g.{" "}
            <code>contentful-cds</code> produces IDs like{" "}
            <code>contentful-cds-&lt;entryId&gt;</code>). Defaults to{" "}
            &ldquo;contentful-cds&rdquo;.
          </FormControl.HelpText>
        </FormControl>
        <FormControl>
          <FormControl.Label>Canonical URL Template</FormControl.Label>
          <TextInput
            value={parameters.canonicalUrlTemplate || ""}
            name="canonicalUrlTemplate"
            onChange={updateParameters("canonicalUrlTemplate")}
            placeholder="https://www.example.org/stories/{slug}"
          />
          <FormControl.HelpText>
            URL template for story canonical web pages. Use{" "}
            <code>{"{slug}"}</code> for the story slug and optionally{" "}
            <code>{"{parentSlug}"}</code> for the slug of a linked parent entry
            (e.g.{" "}
            <code>
              https://www.example.org/shows/{"{parentSlug}"}/stories/{"{slug}"}
            </code>
            ). Leave blank to omit canonical URLs.
          </FormControl.HelpText>
        </FormControl>
        <FormControl>
          <FormControl.Label>Audio Embed URL Template</FormControl.Label>
          <TextInput
            value={parameters.audioEmbedUrlTemplate || ""}
            name="audioEmbedUrlTemplate"
            onChange={updateParameters("audioEmbedUrlTemplate")}
            placeholder="https://www.example.org/shows/{parentSlug}/stories/{slug}/embed"
          />
          <FormControl.HelpText>
            URL template for the audio embedded player link. Supports{" "}
            <code>{"{slug}"}</code> and <code>{"{parentSlug}"}</code>, same as
            the canonical URL template. Leave blank to omit the embedded player
            link.
          </FormControl.HelpText>
        </FormControl>
        <FormControl isRequired isInvalid={!parameters.locale?.trim()}>
          <FormControl.Label>Locale</FormControl.Label>
          <TextInput
            value={parameters.locale || ""}
            name="locale"
            onChange={updateParameters("locale")}
            placeholder="en-US"
          />
          <FormControl.HelpText>
            The Contentful locale to read fields from (e.g. <code>en-US</code>).
          </FormControl.HelpText>
          {!parameters.locale?.trim() && (
            <FormControl.ValidationMessage>
              Please provide a locale.
            </FormControl.ValidationMessage>
          )}
        </FormControl>
        <FormControl>
          <FormControl.Label>Recommend Until (days)</FormControl.Label>
          <TextInput
            type="number"
            value={parameters.recommendUntilDays?.toString() ?? ""}
            name="recommendUntilDays"
            onChange={e =>
              setParameters({
                ...parameters,
                recommendUntilDays: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder="7"
          />
          <FormControl.HelpText>
            Number of days after the publish date to recommend a story in NPR
            One. Defaults to 7.
          </FormControl.HelpText>
        </FormControl>
        <FormControl>
          <FormControl.Label>CDA Include Depth</FormControl.Label>
          <TextInput
            type="number"
            value={parameters.cdaIncludeDepth?.toString() ?? ""}
            name="cdaIncludeDepth"
            onChange={e =>
              setParameters({
                ...parameters,
                cdaIncludeDepth: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder="3"
          />
          <FormControl.HelpText>
            Depth of linked entries/assets to resolve in a single CDA request
            when publishing. Must cover the deepest link chain from your story
            content type (body embed → photo → asset is depth 3). Clamped to [1,
            10]. Defaults to 3.
          </FormControl.HelpText>
        </FormControl>
        <FormControl>
          <Checkbox
            isChecked={parameters.enableLayout ?? false}
            onChange={e =>
              setParameters({ ...parameters, enableLayout: e.target.checked })
            }
          >
            Include story body layout
          </Checkbox>
          <FormControl.HelpText>
            When enabled, the story&rsquo;s Rich Text body is converted to a CDS
            layout array. Disable if your content model does not have a body
            field or you do not want layout data sent to CDS.
          </FormControl.HelpText>
        </FormControl>
      </Form>
    </Flex>
  );
};

export default ConfigScreen;
