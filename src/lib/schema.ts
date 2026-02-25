import type { PlainClientAPI } from "contentful-management";
import { BLOCKS } from "@contentful/rich-text-types";
import type { Document, Block } from "@contentful/rich-text-types";
import { markdownToPlainText } from "./publish";
import type {
  AppInstallationParameters,
  ResolvedEmbedEntry,
  ResolvedImage,
} from "../types";

// ---------------------------------------------------------------------------
// Shared context type passed to all async adapter methods
// ---------------------------------------------------------------------------

export type CmaContext = {
  cma: PlainClientAPI;
  spaceId: string;
  environmentId: string;
};

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

type EntryFields = Record<string, unknown>;

/**
 * SchemaAdapter maps your Contentful content model to the fields the CDS
 * publisher needs. Override any method to match your schema. The simplest
 * starting point is to call createDefaultAdapter() and spread-override only
 * the methods that differ.
 */
export type SchemaAdapter = {
  /** Contentful locale string, e.g. "en-US" */
  locale: string;
  /** Name of the Rich Text body field on your story content type */
  bodyField: string;

  // --- Synchronous field extractors ---
  getTitle(fields: EntryFields): string;
  getSlug(fields: EntryFields): string;
  getPublishDate(fields: EntryFields): string | undefined;
  getTeaser(fields: EntryFields): string | undefined;

  // --- Async resolvers (require CMA) ---
  getBylines(fields: EntryFields, ctx: CmaContext): Promise<string[]>;
  /** Return the slug of the story's parent entry (e.g. a show), used in `{parentSlug}` URL templates. */
  getParentSlug(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<string | undefined>;
  getCanonicalUrl(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<string | undefined>;
  getAdditionalWebPages(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<Array<{ href: string; rels: string[] }>>;
  getAdditionalCollections(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<Array<{ href: string; rels: string[] }>>;
  getDocumentProperties(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<Record<string, unknown>>;
  getImage(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<ResolvedImage | undefined>;
  getAudio(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<
    | {
        url: string;
        duration?: number;
        streamable?: boolean;
        embedUrl?: string;
        downloadable?: boolean;
        rels?: string[];
      }
    | undefined
  >;
  /** Return the embed player URL for the primary audio asset, used as `embeddedPlayerLink` in the CDS document. */
  getAudioEmbedUrl(
    fields: EntryFields,
    ctx: CmaContext
  ): Promise<string | undefined>;

  /**
   * Called once per embedded entry found in the Rich Text body.
   * Return the appropriate ResolvedEmbedEntry for the given content type, or
   * { type: "unknown" } to skip it in the layout.
   */
  resolveBodyEmbed(
    entryId: string,
    contentTypeId: string,
    ctx: CmaContext
  ): Promise<ResolvedEmbedEntry>;
};

// ---------------------------------------------------------------------------
// Internal helpers for the default implementation
// ---------------------------------------------------------------------------

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|wav|opus)$/i;

/** Read a localised field value from a CMA entry/asset fields object. */
const lf = (
  fields: Record<string, Record<string, unknown>> | undefined,
  key: string,
  locale: string
): unknown => fields?.[key]?.[locale];

const resolvePhotoEntry = async (
  entryId: string,
  locale: string,
  ctx: CmaContext
): Promise<ResolvedImage | null> => {
  try {
    const { cma, spaceId, environmentId } = ctx;
    const entry = await cma.entry.get({ spaceId, environmentId, entryId });
    const fields = entry.fields as
      | Record<string, Record<string, unknown>>
      | undefined;

    const assetLink = lf(fields, "asset", locale) as
      | { sys: { id: string } }
      | undefined;
    if (!assetLink?.sys?.id) return null;

    const asset = await cma.asset.get({
      spaceId,
      environmentId,
      assetId: assetLink.sys.id,
    });
    const assetFields = asset.fields as
      | Record<string, Record<string, unknown>>
      | undefined;

    let url =
      (lf(assetFields, "file", locale) as { url?: string } | undefined)?.url ??
      "";
    if (url.startsWith("//")) url = `https:${url}`;
    const details = (
      lf(assetFields, "file", locale) as
        | { details?: { image?: { width: number; height: number } } }
        | undefined
    )?.details?.image;
    const altText =
      (lf(fields, "altText", locale) as string | undefined) ||
      (lf(assetFields, "title", locale) as string | undefined);

    return {
      url,
      altText,
      width: details?.width,
      height: details?.height,
      focusHint: lf(fields, "focusHint", locale) as string | undefined,
      caption: lf(fields, "photoCaption", locale) as string | undefined,
      producer: lf(fields, "photoCredit", locale) as string | undefined,
      provider: lf(fields, "rightsHolder", locale) as string | undefined,
    };
  } catch {
    return null;
  }
};

const resolveMediaLinkEntry = async (
  entryId: string,
  locale: string,
  ctx: CmaContext
): Promise<{
  url: string;
  duration?: number;
  streamable?: boolean;
  embedUrl?: string;
  downloadable?: boolean;
  rels?: string[];
} | null> => {
  try {
    const { cma, spaceId, environmentId } = ctx;
    const entry = await cma.entry.get({ spaceId, environmentId, entryId });
    const fields = entry.fields as
      | Record<string, Record<string, unknown>>
      | undefined;
    const url = (lf(fields, "mediaUrl", locale) as string | undefined) ?? "";
    const durationRaw = lf(fields, "duration", locale) as string | undefined;
    const duration = durationRaw
      ? parseInt(durationRaw, 10) || undefined
      : undefined;
    return url
      ? {
          url,
          duration,
          streamable: false, // This indicates live audio
          rels: ["sponsored", "tracked"],
        }
      : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Default adapter factory (KCRW schema)
// ---------------------------------------------------------------------------

export const createDefaultAdapter = (
  locale: string,
  bodyField = "body",
  params: AppInstallationParameters = {}
): SchemaAdapter => ({
  locale,
  bodyField,

  getTitle: fields =>
    (fields.title as Record<string, string> | undefined)?.[locale] ?? "",
  getSlug: fields =>
    (fields.slug as Record<string, string> | undefined)?.[locale] ?? "",
  getPublishDate: fields =>
    (fields.bylineDate as Record<string, string> | undefined)?.[locale],
  getTeaser: fields => {
    const md = (
      fields.shortDescription as Record<string, string> | undefined
    )?.[locale];
    return md ? markdownToPlainText(md) : undefined;
  },

  async getBylines(fields, ctx) {
    const hostLinks = ((
      fields.hosts as Record<string, unknown[]> | undefined
    )?.[locale] ?? []) as Array<{ sys: { id: string } }>;
    const reporterLinks = ((
      fields.reporters as Record<string, unknown[]> | undefined
    )?.[locale] ?? []) as Array<{ sys: { id: string } }>;
    const names = await Promise.all(
      [...hostLinks, ...reporterLinks].map(async link => {
        try {
          const entry = await ctx.cma.entry.get({
            spaceId: ctx.spaceId,
            environmentId: ctx.environmentId,
            entryId: link.sys.id,
          });
          const f = entry.fields as
            | Record<string, Record<string, unknown>>
            | undefined;
          return (lf(f, "name", locale) as string | undefined) ?? null;
        } catch {
          return null;
        }
      })
    );
    return names.filter((n): n is string => !!n);
  },

  async getParentSlug(fields, ctx) {
    const showLinks = ((
      fields.shows as Record<string, unknown[]> | undefined
    )?.[locale] ?? []) as Array<{ sys: { id: string } }>;
    if (!showLinks.length) return undefined;
    try {
      const showEntry = await ctx.cma.entry.get({
        spaceId: ctx.spaceId,
        environmentId: ctx.environmentId,
        entryId: showLinks[0].sys.id,
      });
      const showFields = showEntry.fields as
        | Record<string, Record<string, unknown>>
        | undefined;
      return lf(showFields, "slug", locale) as string | undefined;
    } catch {
      return undefined;
    }
  },

  async getAdditionalWebPages(_fields, _ctx) {
    return [];
  },

  async getAdditionalCollections(_fields, _ctx) {
    return [];
  },

  async getDocumentProperties(_fields, _ctx) {
    return {};
  },

  async getCanonicalUrl(fields, ctx) {
    const slug = this.getSlug(fields);
    if (!slug) return undefined;

    const template = params.canonicalUrlTemplate;
    if (!template) return undefined;

    if (template.includes("{parentSlug}")) {
      const parentSlug = await this.getParentSlug(fields, ctx);
      return parentSlug
        ? template.replace("{parentSlug}", parentSlug).replace("{slug}", slug)
        : undefined;
    }

    return template.replace("{slug}", slug);
  },

  async getImage(fields, ctx) {
    const link = (fields.primaryImage as Record<string, unknown> | undefined)?.[
      locale
    ] as { sys: { id: string } } | undefined;
    if (!link?.sys?.id) return undefined;
    return (await resolvePhotoEntry(link.sys.id, locale, ctx)) ?? undefined;
  },

  async getAudioEmbedUrl(fields, ctx) {
    const template = params.audioEmbedUrlTemplate;
    if (!template) return undefined;

    const slug = this.getSlug(fields);
    if (!slug) return undefined;

    if (template.includes("{parentSlug}")) {
      const parentSlug = await this.getParentSlug(fields, ctx);
      return parentSlug
        ? template.replace("{parentSlug}", parentSlug).replace("{slug}", slug)
        : undefined;
    }

    return template.replace("{slug}", slug);
  },

  async getAudio(fields, ctx) {
    const link = (fields.audioMedia as Record<string, unknown> | undefined)?.[
      locale
    ] as { sys: { id: string } } | undefined;
    if (!link?.sys?.id) return undefined;
    const resolved = await resolveMediaLinkEntry(link.sys.id, locale, ctx);
    if (!resolved) return undefined;
    const embedUrl = await this.getAudioEmbedUrl(fields, ctx);
    return { ...resolved, embedUrl };
  },

  async resolveBodyEmbed(entryId, contentTypeId, ctx) {
    if (contentTypeId === "htmlEmbed") {
      try {
        const entry = await ctx.cma.entry.get({
          spaceId: ctx.spaceId,
          environmentId: ctx.environmentId,
          entryId,
        });
        const fields = entry.fields as
          | Record<string, Record<string, unknown>>
          | undefined;
        const html = lf(fields, "embedCode", locale) as string | undefined;
        if (html) return { type: "html" as const, html };
      } catch {
        /* fall through */
      }
      return { type: "unknown" as const };
    }
    if (contentTypeId === "photo") {
      const resolved = await resolvePhotoEntry(entryId, locale, ctx);
      return resolved
        ? { type: "image" as const, ...resolved }
        : { type: "unknown" as const };
    }
    if (contentTypeId === "mediaLink") {
      const resolved = await resolveMediaLinkEntry(entryId, locale, ctx);
      if (resolved) {
        const ytMatch = resolved.url.match(YOUTUBE_REGEX);
        if (ytMatch) return { type: "youtube" as const, videoId: ytMatch[1] };
        try {
          const urlPath = new URL(resolved.url).pathname;
          if (AUDIO_EXTENSIONS.test(urlPath)) {
            return {
              type: "audio" as const,
              url: resolved.url,
              duration: resolved.duration,
            };
          }
        } catch {
          /* fall through */
        }
      }
    }
    return { type: "unknown" as const };
  },
});

// ---------------------------------------------------------------------------
// Customization point
// ---------------------------------------------------------------------------

/**
 * Builds the SchemaAdapter used by the publish pipeline.
 *
 * This is the intended place to adapt the app to your content model.
 * Spread createDefaultAdapter() and override only the methods that differ:
 *
 *   export const buildAdapter = (locale: string, params: AppInstallationParameters = {}): SchemaAdapter => ({
 *     ...createDefaultAdapter(locale, "body", params),
 *     async getBylines(fields, ctx) { ... },
 *     async getCanonicalUrl(fields, ctx) { ... },
 *   });
 */
export const buildAdapter = (
  locale: string,
  params: AppInstallationParameters = {}
): SchemaAdapter => ({
  ...createDefaultAdapter(locale, "body", params),
});

// ---------------------------------------------------------------------------
// Generic body embed resolver (schema-agnostic, delegates to adapter)
// ---------------------------------------------------------------------------

export const resolveBodyEmbeds = async (
  body: Document,
  adapter: SchemaAdapter,
  ctx: CmaContext
): Promise<Map<string, ResolvedEmbedEntry>> => {
  const embedMap = new Map<string, ResolvedEmbedEntry>();
  const entryIds = new Set<string>();
  const assetIds = new Set<string>();

  const walkNode = (node: Block | Document) => {
    for (const child of node.content ?? []) {
      if (child.nodeType === BLOCKS.EMBEDDED_ENTRY) {
        const id = (child as Block).data?.target?.sys?.id as string | undefined;
        if (id) entryIds.add(id);
      } else if (child.nodeType === BLOCKS.EMBEDDED_ASSET) {
        const id = (child as Block).data?.target?.sys?.id as string | undefined;
        if (id) assetIds.add(id);
      }
      if ("content" in child && Array.isArray((child as Block).content)) {
        walkNode(child as Block);
      }
    }
  };
  walkNode(body);

  const { cma, spaceId, environmentId } = ctx;

  await Promise.all([
    ...Array.from(entryIds).map(async embedEntryId => {
      try {
        const entry = await cma.entry.get({
          spaceId,
          environmentId,
          entryId: embedEntryId,
        });
        const contentTypeId =
          (entry.sys?.contentType?.sys?.id as string | undefined) ?? "";
        embedMap.set(
          embedEntryId,
          await adapter.resolveBodyEmbed(embedEntryId, contentTypeId, ctx)
        );
      } catch {
        embedMap.set(embedEntryId, { type: "unknown" });
      }
    }),
    ...Array.from(assetIds).map(async assetId => {
      try {
        const asset = await cma.asset.get({ spaceId, environmentId, assetId });
        const assetFields = asset.fields as
          | Record<string, Record<string, unknown>>
          | undefined;
        let url =
          (
            lf(assetFields, "file", adapter.locale) as
              | { url?: string }
              | undefined
          )?.url ?? "";
        if (url.startsWith("//")) url = `https:${url}`;
        if (!url) {
          embedMap.set(assetId, { type: "unknown" });
          return;
        }
        const details = (
          lf(assetFields, "file", adapter.locale) as
            | { details?: { image?: { width: number; height: number } } }
            | undefined
        )?.details?.image;
        const altText = lf(assetFields, "title", adapter.locale) as
          | string
          | undefined;
        embedMap.set(assetId, {
          type: "image",
          url,
          altText,
          width: details?.width,
          height: details?.height,
        });
      } catch {
        embedMap.set(assetId, { type: "unknown" });
      }
    }),
  ]);

  return embedMap;
};
