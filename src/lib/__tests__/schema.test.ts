/**
 * Tests for schema-module behavior that is independent of any specific
 * Contentful content model: `resolveBodyEmbeds` (the generic Rich Text walker)
 * and `buildAdapter` (the customization point).
 *
 * KCRW-specific `createDefaultAdapter` behavior lives in defaultAdapter.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BLOCKS } from "@contentful/rich-text-types";
import type { Document } from "@contentful/rich-text-types";
import type { EntrySource, SourcedAsset } from "../entrySource";
import type { ReadContext, SchemaAdapter } from "../schema";
import { buildAdapter, resolveBodyEmbeds } from "../schema";
import { docOf, embeddedEntry, embeddedAsset } from "./helpers";

// ---------------------------------------------------------------------------
// Fakes — minimal EntrySource (asset-only) and adapter that returns a
// deterministic embed per content type so tests pin walker behavior, not
// adapter behavior.
// ---------------------------------------------------------------------------

let assets: Map<string, SourcedAsset | null>;
let resolveCalls: Array<{ entryId: string; contentTypeId: string }>;
let entryContentTypes: Map<string, string | null>;
let ctx: ReadContext;

beforeEach(() => {
  assets = new Map();
  resolveCalls = [];
  entryContentTypes = new Map();

  const entrySource: EntrySource = {
    async prime() {
      return null;
    },
    async getEntry(id) {
      const ct = entryContentTypes.get(id);
      if (ct === undefined || ct === null) return null;
      return { id, contentType: ct, fields: {} };
    },
    async getAsset(id) {
      return assets.get(id) ?? null;
    },
  };

  ctx = { entrySource };
});

const fakeAdapter: SchemaAdapter = {
  // Only resolveBodyEmbed is invoked by resolveBodyEmbeds; other fields are
  // unused but required by the SchemaAdapter type.
  locale: "en-US",
  bodyField: "body",
  audioLinkField: "audioMedia",
  titleField: "title",
  publishDateField: "bylineDate",
  contentTypeId: "story",
  videoLinkField: "videoMedia",
  getTitle: () => "",
  getSlug: () => "",
  getPublishDate: () => undefined,
  getTeaser: () => undefined,
  async getBylines() {
    return [];
  },
  async getParentSlug() {
    return undefined;
  },
  async getCanonicalUrl() {
    return undefined;
  },
  async getAdditionalWebPages() {
    return [];
  },
  async getAdditionalCollections() {
    return [];
  },
  async getDocumentProperties() {
    return {};
  },
  async getImage() {
    return undefined;
  },
  async getAudio() {
    return undefined;
  },
  async getAudioEmbedUrl() {
    return undefined;
  },
  async getVideo() {
    return undefined;
  },
  async resolveBodyEmbed(entryId, contentTypeId) {
    resolveCalls.push({ entryId, contentTypeId });
    return { type: "html", html: `<!--${contentTypeId}:${entryId}-->` };
  },
};

const setAsset = (
  id: string,
  url: string,
  width = 800,
  height = 600,
  title = "Asset"
): void => {
  assets.set(id, { id, url, width, height, title });
};

const setEntry = (id: string, contentType: string): void => {
  entryContentTypes.set(id, contentType);
};

// ---------------------------------------------------------------------------

describe("resolveBodyEmbeds", () => {
  it("delegates each embedded entry to adapter.resolveBodyEmbed with its content type", async () => {
    setEntry("p1", "photo");
    setEntry("v1", "mediaLink");
    const embedMap = await resolveBodyEmbeds(
      docOf(embeddedEntry("p1"), embeddedEntry("v1")),
      fakeAdapter,
      ctx
    );
    expect(resolveCalls).toEqual(
      expect.arrayContaining([
        { entryId: "p1", contentTypeId: "photo" },
        { entryId: "v1", contentTypeId: "mediaLink" },
      ])
    );
    expect(embedMap.get("p1")).toEqual({
      type: "html",
      html: "<!--photo:p1-->",
    });
    expect(embedMap.get("v1")).toEqual({
      type: "html",
      html: "<!--mediaLink:v1-->",
    });
  });

  // Embedded assets bypass the adapter — the walker handles them directly so
  // any schema can use a Rich Text asset embed without writing an adapter case.
  it("resolves embedded assets directly to image without invoking the adapter", async () => {
    setAsset(
      "a1",
      "https://example.com/asset.jpg",
      1000,
      800,
      "Embedded Asset"
    );
    const embedMap = await resolveBodyEmbeds(
      docOf(embeddedAsset("a1")),
      fakeAdapter,
      ctx
    );
    expect(resolveCalls).toEqual([]);
    expect(embedMap.get("a1")).toEqual({
      type: "image",
      url: "https://example.com/asset.jpg",
      altText: "Embedded Asset",
      width: 1000,
      height: 800,
    });
  });

  it("marks missing entries and assets as unknown", async () => {
    // Neither setEntry nor setAsset called → both lookups return null.
    const embedMap = await resolveBodyEmbeds(
      docOf(embeddedEntry("missing-entry"), embeddedAsset("missing-asset")),
      fakeAdapter,
      ctx
    );
    expect(embedMap.get("missing-entry")).toEqual({ type: "unknown" });
    expect(embedMap.get("missing-asset")).toEqual({ type: "unknown" });
  });

  it("walks nested content and ignores non-embed nodes", async () => {
    setEntry("p1", "photo");
    const doc: Document = docOf(
      {
        nodeType: BLOCKS.PARAGRAPH,
        data: {},
        content: [{ nodeType: "text", data: {}, value: "Text", marks: [] }],
      },
      // Embedded entry nested inside a quote — walker must recurse into it.
      {
        nodeType: BLOCKS.QUOTE,
        data: {},
        content: [embeddedEntry("p1")],
      }
    );
    const embedMap = await resolveBodyEmbeds(doc, fakeAdapter, ctx);
    expect(embedMap.size).toBe(1);
    expect(embedMap.has("p1")).toBe(true);
  });

  it("deduplicates repeated embed targets (resolves each id once)", async () => {
    setEntry("p1", "photo");
    await resolveBodyEmbeds(
      docOf(embeddedEntry("p1"), embeddedEntry("p1"), embeddedEntry("p1")),
      fakeAdapter,
      ctx
    );
    expect(resolveCalls).toEqual([{ entryId: "p1", contentTypeId: "photo" }]);
  });
});

// ---------------------------------------------------------------------------
// buildAdapter — customization-point contract.
//
// `buildAdapter` is `{ ...createDefaultAdapter(...) }`, so it must be
// instantiated through the default adapter. The assertion here is generic:
// callers can spread the result and override one method, and other methods
// that read it via `this` will pick up the override.
// ---------------------------------------------------------------------------

describe("buildAdapter", () => {
  it("methods called via `this` pick up spread-overrides", async () => {
    const base = buildAdapter("en-US", {
      canonicalUrlTemplate: "https://x/{slug}",
    });
    const overridden = { ...base, getSlug: () => "OVERRIDDEN" };
    expect(await overridden.getCanonicalUrl({}, ctx)).toBe(
      "https://x/OVERRIDDEN"
    );
  });
});
