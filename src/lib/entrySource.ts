/**
 * Port for fetching Contentful entries/assets from the Content Delivery API (CDA).
 *
 * The CDA only returns published content — draft changes in Contentful cannot
 * leak into the CDS document. Fields are locale-resolved (no `{ "en-US": value }`
 * wrappers); callers read values with `entry.fields[fieldName]` directly.
 */

export type SourcedEntry = {
  id: string;
  contentType: string;
  fields: Record<string, unknown>;
};

export type SourcedAsset = {
  id: string;
  url: string;
  width: number | undefined;
  height: number | undefined;
  title: string | undefined;
};

export interface EntrySource {
  getEntry(id: string): Promise<SourcedEntry | null>;
  getAsset(id: string): Promise<SourcedAsset | null>;
}

type CdaEntry = {
  sys: { id: string; contentType: { sys: { id: string } } };
  fields: Record<string, unknown>;
};

type CdaAsset = {
  sys: { id: string };
  fields: {
    title?: string;
    file?: {
      url?: string;
      details?: { image?: { width?: number; height?: number } };
    };
  };
};

/**
 * Creates an EntrySource backed by the Contentful Delivery API (CDA).
 * The CDA only returns published entries; drafts are not accessible.
 */
export const createDeliveryEntrySource = (config: {
  baseUrl?: string;
  token: string;
  spaceId: string;
  environmentId: string;
  locale: string;
}): EntrySource => {
  const { token, spaceId, environmentId, locale } = config;
  const baseUrl = (config.baseUrl ?? "https://cdn.contentful.com").replace(
    /\/$/,
    ""
  );
  const root = `${baseUrl}/spaces/${spaceId}/environments/${environmentId}`;
  const headers = { Authorization: `Bearer ${token}` };

  const apiFetch = async <T>(url: string): Promise<T | null> => {
    const resp = await fetch(url, { headers });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      throw new Error(
        `Contentful Delivery API error ${resp.status} fetching ${url}`
      );
    }
    return (await resp.json()) as T;
  };

  const normalizeEntry = (e: CdaEntry): SourcedEntry => ({
    id: e.sys.id,
    contentType: e.sys.contentType.sys.id,
    fields: e.fields,
  });

  const normalizeAsset = (a: CdaAsset): SourcedAsset | null => {
    const file = a.fields.file;
    if (!file?.url) return null;
    const url = file.url.startsWith("//") ? `https:${file.url}` : file.url;
    return {
      id: a.sys.id,
      url,
      width: file.details?.image?.width,
      height: file.details?.image?.height,
      title: a.fields.title,
    };
  };

  return {
    async getEntry(id) {
      const data = await apiFetch<CdaEntry>(
        `${root}/entries/${encodeURIComponent(id)}?locale=${locale}`
      );
      return data ? normalizeEntry(data) : null;
    },
    async getAsset(id) {
      const data = await apiFetch<CdaAsset>(
        `${root}/assets/${encodeURIComponent(id)}?locale=${locale}`
      );
      return data ? normalizeAsset(data) : null;
    },
  };
};
