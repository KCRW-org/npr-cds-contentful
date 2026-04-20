import { BLOCKS } from "@contentful/rich-text-types";
import type { Document, Block } from "@contentful/rich-text-types";
import { markdownToPlainText } from "./publish";
import type { EntrySource } from "./entrySource";
import type {
  AppInstallationParameters,
  ResolvedEmbedEntry,
  ResolvedImage,
} from "../types";

// ---------------------------------------------------------------------------
// Shared context passed to all async adapter methods
// ---------------------------------------------------------------------------

/**
 * Read context for adapter methods. Backed by the Content Delivery API, so
 * all reads return published content only — draft changes cannot leak into
 * the CDS document.
 *
 * Fields on any `SourcedEntry` returned by `entrySource` are already
 * locale-resolved (read `entry.fields.foo` directly, not `entry.fields.foo[locale]`).
 */
export type ReadContext = {
  entrySource: EntrySource;
};

// Backwards-compatible alias; existing adapters typed against `CmaContext` still compile.
export type CmaContext = ReadContext;

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

type EntryFields = Record<string, unknown>;

/**
 * SchemaAdapter maps your Contentful content model to the fields the CDS
 * publisher needs. Override any method to match your schema. The simplest
 * starting point is to call createDefaultAdapter() and spread-override only
 * the methods that differ.
 *
 * `fields` passed to every method is already locale-resolved (e.g.
 * `fields.title` is the string, not `{ "en-US": "..." }`).
 */
export type SchemaAdapter = {
  /** Contentful locale string, e.g. "en-US" */
  locale: string;
  /** Name of the Rich Text body field on your story content type */
  bodyField: string;
  /**
   * Name of the field linking to the primary audio entry on your story
   * content type. Used by the sidebar to check the Featured-collection
   * requirement (linked audio must be published) without duplicating the
   * schema knowledge that lives in `getAudio()`.
   */
  audioLinkField: string;

  // --- Synchronous field extractors ---
  getTitle(fields: EntryFields): string;
  getSlug(fields: EntryFields): string;
  getPublishDate(fields: EntryFields): string | undefined;
  getTeaser(fields: EntryFields): string | undefined;

  // --- Async resolvers (use the CDA-backed entry source) ---
  getBylines(fields: EntryFields, ctx: ReadContext): Promise<string[]>;
  /** Return the slug of the story's parent entry (e.g. a show), used in `{parentSlug}` URL templates. */
  getParentSlug(
    fields: EntryFields,
    ctx: ReadContext
  ): Promise<string | undefined>;
  getCanonicalUrl(
    fields: EntryFields,
    ctx: ReadContext
  ): Promise<string | undefined>;
  getAdditionalWebPages(
    fields: EntryFields,
    ctx: ReadContext
  ): Promise<Array<{ href: string; rels: string[] }>>;
  getAdditionalCollections(
    fields: EntryFields,
    ctx: ReadContext
  ): Promise<Array<{ href: string; rels: string[] }>>;
  getDocumentProperties(
    fields: EntryFields,
    ctx: ReadContext
  ): Promise<Record<string, unknown>>;
  getImage(
    fields: EntryFields,
    ctx: ReadContext
  ): Promise<ResolvedImage | undefined>;
  getAudio(
    fields: EntryFields,
    ctx: ReadContext
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
    ctx: ReadContext
  ): Promise<string | undefined>;

  /**
   * Called once per embedded entry found in the Rich Text body.
   * Return the appropriate ResolvedEmbedEntry for the given content type, or
   * { type: "unknown" } to skip it in the layout.
   */
  resolveBodyEmbed(
    entryId: string,
    contentTypeId: string,
    ctx: ReadContext
  ): Promise<ResolvedEmbedEntry>;
};

// ---------------------------------------------------------------------------
// Internal helpers for the default implementation
// ---------------------------------------------------------------------------

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|wav|opus)$/i;

const resolvePhotoEntry = async (
  entryId: string,
  ctx: ReadContext
): Promise<ResolvedImage | null> => {
  const entry = await ctx.entrySource.getEntry(entryId);
  if (!entry) return null;
  const fields = entry.fields;

  const assetLink = fields.asset as { sys?: { id?: string } } | undefined;
  if (!assetLink?.sys?.id) return null;

  const asset = await ctx.entrySource.getAsset(assetLink.sys.id);
  if (!asset) return null;

  return {
    url: asset.url,
    altText: (fields.altText as string | undefined) || asset.title || undefined,
    width: asset.width,
    height: asset.height,
    focusHint: fields.focusHint as string | undefined,
    caption: fields.photoCaption as string | undefined,
    producer: fields.photoCredit as string | undefined,
    provider: fields.rightsHolder as string | undefined,
  };
};

const resolveMediaLinkEntry = async (
  entryId: string,
  ctx: ReadContext
): Promise<{
  url: string;
  duration?: number;
  streamable?: boolean;
  embedUrl?: string;
  downloadable?: boolean;
  rels?: string[];
} | null> => {
  const entry = await ctx.entrySource.getEntry(entryId);
  if (!entry) return null;
  const fields = entry.fields;
  const url = (fields.mediaUrl as string | undefined) ?? "";
  const durationRaw = fields.duration as string | undefined;
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
  audioLinkField: "audioMedia",

  getTitle: fields => (fields.title as string | undefined) ?? "",
  getSlug: fields => (fields.slug as string | undefined) ?? "",
  getPublishDate: fields => fields.bylineDate as string | undefined,
  getTeaser: fields => {
    const md = fields.shortDescription as string | undefined;
    return md ? markdownToPlainText(md) : undefined;
  },

  async getBylines(fields, ctx) {
    const hostLinks = (fields.hosts ?? []) as Array<{ sys: { id: string } }>;
    const reporterLinks = (fields.reporters ?? []) as Array<{
      sys: { id: string };
    }>;
    const names = await Promise.all(
      [...hostLinks, ...reporterLinks].map(async link => {
        const entry = await ctx.entrySource.getEntry(link.sys.id);
        return (entry?.fields.name as string | undefined) ?? null;
      })
    );
    return names.filter((n): n is string => !!n);
  },

  async getParentSlug(fields, ctx) {
    const showLinks = (fields.shows ?? []) as Array<{ sys: { id: string } }>;
    if (!showLinks.length) return undefined;
    const showEntry = await ctx.entrySource.getEntry(showLinks[0].sys.id);
    return showEntry?.fields.slug as string | undefined;
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
    const link = fields.primaryImage as { sys?: { id?: string } } | undefined;
    if (!link?.sys?.id) return undefined;
    return (await resolvePhotoEntry(link.sys.id, ctx)) ?? undefined;
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
    const link = fields[this.audioLinkField] as
      | { sys?: { id?: string } }
      | undefined;
    if (!link?.sys?.id) return undefined;
    const resolved = await resolveMediaLinkEntry(link.sys.id, ctx);
    if (!resolved) return undefined;
    const embedUrl = await this.getAudioEmbedUrl(fields, ctx);
    return { ...resolved, embedUrl };
  },

  async resolveBodyEmbed(entryId, contentTypeId, ctx) {
    if (contentTypeId === "htmlEmbed") {
      const entry = await ctx.entrySource.getEntry(entryId);
      const html = entry?.fields.embedCode as string | undefined;
      if (html) return { type: "html" as const, html };
      return { type: "unknown" as const };
    }
    if (contentTypeId === "photo") {
      const resolved = await resolvePhotoEntry(entryId, ctx);
      return resolved
        ? { type: "image" as const, ...resolved }
        : { type: "unknown" as const };
    }
    if (contentTypeId === "mediaLink") {
      const resolved = await resolveMediaLinkEntry(entryId, ctx);
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
  ctx: ReadContext
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

  await Promise.all([
    ...Array.from(entryIds).map(async embedEntryId => {
      const entry = await ctx.entrySource.getEntry(embedEntryId);
      if (!entry) {
        embedMap.set(embedEntryId, { type: "unknown" });
        return;
      }
      embedMap.set(
        embedEntryId,
        await adapter.resolveBodyEmbed(embedEntryId, entry.contentType, ctx)
      );
    }),
    ...Array.from(assetIds).map(async assetId => {
      const asset = await ctx.entrySource.getAsset(assetId);
      if (!asset) {
        embedMap.set(assetId, { type: "unknown" });
        return;
      }
      embedMap.set(assetId, {
        type: "image",
        url: asset.url,
        altText: asset.title,
        width: asset.width,
        height: asset.height,
      });
    }),
  ]);

  return embedMap;
};
