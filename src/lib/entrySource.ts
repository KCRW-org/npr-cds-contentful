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
  /**
   * Fetch the entry together with all linked entries/assets up to `depth`
   * levels deep in a single CDA request. Populates the internal cache that
   * `getEntry`/`getAsset` read from; no fallback request is ever issued, so
   * link targets deeper than `depth` (or unpublished/archived/missing) are
   * returned as `null`. A `console.warn` is emitted for each referenced ID
   * that wasn't in the response so misconfigured depth is visible in logs
   * rather than silently shipping incomplete CDS documents.
   *
   * `depth` is clamped to the CDA-supported range [1, 10].
   */
  prime(id: string, depth?: number): Promise<SourcedEntry | null>;
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

type CdaEntriesResponse = {
  items: CdaEntry[];
  includes?: { Entry?: CdaEntry[]; Asset?: CdaAsset[] };
};

const collectLinks = (
  value: unknown,
  entries: Set<string>,
  assets: Set<string>
): void => {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectLinks(item, entries, assets);
    return;
  }
  const obj = value as Record<string, unknown>;
  const sys = obj.sys as
    | { type?: string; linkType?: string; id?: string }
    | undefined;
  if (sys?.type === "Link" && typeof sys.id === "string") {
    if (sys.linkType === "Entry") entries.add(sys.id);
    else if (sys.linkType === "Asset") assets.add(sys.id);
    return;
  }
  for (const child of Object.values(obj)) collectLinks(child, entries, assets);
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

  const entryCache = new Map<string, SourcedEntry | null>();
  const assetCache = new Map<string, SourcedAsset | null>();

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
    async prime(id, depth = 3) {
      const safeDepth = Number.isFinite(depth) ? Math.floor(depth) : 3;
      const clampedDepth = Math.max(1, Math.min(10, safeDepth));
      const data = await apiFetch<CdaEntriesResponse>(
        `${root}/entries?sys.id=${encodeURIComponent(
          id
        )}&include=${clampedDepth}&locale=${locale}`
      );
      if (!data || !data.items.length) {
        entryCache.set(id, null);
        return null;
      }

      const primary = normalizeEntry(data.items[0]);
      entryCache.set(primary.id, primary);
      for (const e of data.includes?.Entry ?? []) {
        entryCache.set(e.sys.id, normalizeEntry(e));
      }
      for (const a of data.includes?.Asset ?? []) {
        assetCache.set(a.sys.id, normalizeAsset(a));
      }

      // Cache a `null` for any link target missing from the includes payload
      // (unpublished, archived, deleted, or beyond the configured include
      // depth) so `getEntry`/`getAsset` return `null` without re-fetching.
      // Warn so misconfigured depth doesn't silently produce incomplete docs.
      const referencedEntries = new Set<string>();
      const referencedAssets = new Set<string>();
      for (const entry of entryCache.values()) {
        if (entry)
          collectLinks(entry.fields, referencedEntries, referencedAssets);
      }
      const missingEntries: string[] = [];
      const missingAssets: string[] = [];
      for (const ref of referencedEntries) {
        if (!entryCache.has(ref)) {
          entryCache.set(ref, null);
          missingEntries.push(ref);
        }
      }
      for (const ref of referencedAssets) {
        if (!assetCache.has(ref)) {
          assetCache.set(ref, null);
          missingAssets.push(ref);
        }
      }
      if (missingEntries.length || missingAssets.length) {
        console.warn(
          `[entrySource] prime(${id}, depth=${clampedDepth}) left ${missingEntries.length} entry and ${missingAssets.length} asset references uncached. ` +
            `These may be unpublished/archived/missing, or deeper than the configured include depth. ` +
            `Entries: ${missingEntries.join(", ") || "(none)"}; Assets: ${missingAssets.join(", ") || "(none)"}.`
        );
      }

      return primary;
    },

    async getEntry(id) {
      return entryCache.get(id) ?? null;
    },

    async getAsset(id) {
      return assetCache.get(id) ?? null;
    },
  };
};
