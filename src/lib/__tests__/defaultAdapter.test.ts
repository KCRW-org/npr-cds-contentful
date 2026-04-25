/**
 * Tests for `createDefaultAdapter`, the KCRW schema mapping.
 *
 * These tests pin KCRW-specific knowledge: content type names (`photo`,
 * `mediaLink`, `htmlEmbed`, `show`, `host`, `reporter`) and field names
 * (`primaryImage`, `audioMedia`, `videoMedia`, `shortDescription`,
 * `bylineDate`, `hosts`, `reporters`, `shows`, `photoCaption`, etc.).
 *
 * Generic schema-module behavior (the `resolveBodyEmbeds` walker, the
 * `SchemaAdapter` interface) lives in schema.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { EntrySource, SourcedEntry, SourcedAsset } from "../entrySource";
import type { ReadContext } from "../schema";
import { createDefaultAdapter } from "../schema";

// Shared fixtures: each test gets fresh maps + ctx via beforeEach.
let entries: Map<string, SourcedEntry | null>;
let assets: Map<string, SourcedAsset | null>;
let ctx: ReadContext;

beforeEach(() => {
  entries = new Map();
  assets = new Map();
  ctx = {
    entrySource: {
      async prime() {
        return null;
      },
      async getEntry(id) {
        return entries.get(id) ?? null;
      },
      async getAsset(id) {
        return assets.get(id) ?? null;
      },
    } satisfies EntrySource,
  };
});

const setMediaLink = (id: string, fields: Record<string, unknown>): void => {
  entries.set(id, { id, contentType: "mediaLink", fields });
};

const setPhoto = (
  id: string,
  assetId: string | null,
  extra: Record<string, unknown> = {}
): void => {
  entries.set(id, {
    id,
    contentType: "photo",
    fields: {
      ...(assetId ? { asset: { sys: { id: assetId } } } : {}),
      ...extra,
    },
  });
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

const adapter = (params = {}) => createDefaultAdapter("en-US", "body", params);

// ---------------------------------------------------------------------------
// getVideo (mediaLink content type with `mediaUrl`/`hosting`/`duration` fields)
// ---------------------------------------------------------------------------

describe("getVideo — YouTube URL extraction", () => {
  it.each([
    ["watch?v=", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["youtu.be shortlink", "https://youtu.be/dQw4w9WgXcQ"],
    ["embed", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["shorts", "https://www.youtube.com/shorts/dQw4w9WgXcQ"],
    [
      "extra query params",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s&list=PLxxx",
    ],
  ])("extracts videoId from %s", async (_name, mediaUrl) => {
    setMediaLink("v", { mediaUrl, hosting: "youtube" });
    const result = await adapter().getVideo(
      { videoMedia: { sys: { id: "v" } } },
      ctx
    );
    expect(result).toEqual({ type: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  it.each([
    ["non-YouTube URL", "https://example.com/not-youtube"],
    ["malformed URL", "not-a-url"],
  ])("returns undefined for %s", async (_name, mediaUrl) => {
    setMediaLink("v", { mediaUrl, hosting: "youtube" });
    const result = await adapter().getVideo(
      { videoMedia: { sys: { id: "v" } } },
      ctx
    );
    expect(result).toBeUndefined();
  });
});

describe("getVideo — file classification", () => {
  it.each([
    [".mp4", "video.mp4", "video/mp4"],
    [".webm", "video.webm", "video/webm"],
    [".mov", "video.mov", "video/quicktime"],
    [".m4v", "video.m4v", "video/mp4"],
  ])("classifies %s", async (_ext, file, mime) => {
    setMediaLink("v", {
      mediaUrl: `https://example.com/${file}`,
      hosting: "file",
      duration: "300",
    });
    const result = await adapter().getVideo(
      { videoMedia: { sys: { id: "v" } } },
      ctx
    );
    expect(result).toEqual({
      type: mime,
      url: `https://example.com/${file}`,
      duration: 300,
      rels: ["sponsored", "tracked"],
    });
  });

  it.each([
    ["unknown extension", "https://example.com/video.xyz"],
    ["malformed URL", "not-a-url"],
  ])("returns undefined for %s", async (_name, mediaUrl) => {
    setMediaLink("v", { mediaUrl, hosting: "file" });
    const result = await adapter().getVideo(
      { videoMedia: { sys: { id: "v" } } },
      ctx
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when no video link is present", async () => {
    expect(await adapter().getVideo({}, ctx)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Synchronous field readers
// ---------------------------------------------------------------------------

describe("getParentSlug", () => {
  it("resolves first show's slug", async () => {
    entries.set("show-1", {
      id: "show-1",
      contentType: "show",
      fields: { slug: "parent-show-slug" },
    });
    const slug = await adapter().getParentSlug(
      { shows: [{ sys: { id: "show-1" } }] },
      ctx
    );
    expect(slug).toBe("parent-show-slug");
  });

  it("returns undefined when no shows linked", async () => {
    expect(await adapter().getParentSlug({ shows: [] }, ctx)).toBeUndefined();
  });

  it("returns undefined when show entry missing", async () => {
    entries.set("show-1", null);
    const slug = await adapter().getParentSlug(
      { shows: [{ sys: { id: "show-1" } }] },
      ctx
    );
    expect(slug).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// URL templates
// ---------------------------------------------------------------------------

describe("getCanonicalUrl", () => {
  it("substitutes {slug}", async () => {
    const url = await adapter({
      canonicalUrlTemplate: "https://example.com/stories/{slug}",
    }).getCanonicalUrl({ slug: "test-story" }, ctx);
    expect(url).toBe("https://example.com/stories/test-story");
  });

  it("substitutes {parentSlug} and {slug}", async () => {
    entries.set("show-1", {
      id: "show-1",
      contentType: "show",
      fields: { slug: "my-show" },
    });
    const url = await adapter({
      canonicalUrlTemplate: "https://example.com/{parentSlug}/stories/{slug}",
    }).getCanonicalUrl(
      { slug: "test-story", shows: [{ sys: { id: "show-1" } }] },
      ctx
    );
    expect(url).toBe("https://example.com/my-show/stories/test-story");
  });

  it("returns undefined when no template", async () => {
    expect(await adapter().getCanonicalUrl({ slug: "x" }, ctx)).toBeUndefined();
  });

  it("returns undefined when slug empty", async () => {
    const url = await adapter({
      canonicalUrlTemplate: "https://example.com/stories/{slug}",
    }).getCanonicalUrl({ slug: "" }, ctx);
    expect(url).toBeUndefined();
  });

  it("returns undefined when {parentSlug} required but absent", async () => {
    const url = await adapter({
      canonicalUrlTemplate: "https://example.com/{parentSlug}/stories/{slug}",
    }).getCanonicalUrl({ slug: "test-story", shows: [] }, ctx);
    expect(url).toBeUndefined();
  });
});

describe("getAudioEmbedUrl", () => {
  it("uses audioEmbedUrlTemplate (not canonicalUrlTemplate)", async () => {
    const url = await adapter({
      audioEmbedUrlTemplate: "https://example.com/player/{slug}",
      canonicalUrlTemplate: "https://other.example.com/{slug}",
    }).getAudioEmbedUrl({ slug: "test-story" }, ctx);
    expect(url).toBe("https://example.com/player/test-story");
  });

  it("returns undefined when audioEmbedUrlTemplate is missing", async () => {
    expect(
      await adapter().getAudioEmbedUrl({ slug: "x" }, ctx)
    ).toBeUndefined();
  });

  it("substitutes {parentSlug} from linked show", async () => {
    entries.set("show-1", {
      id: "show-1",
      contentType: "show",
      fields: { slug: "my-show" },
    });
    const url = await adapter({
      audioEmbedUrlTemplate: "https://example.com/{parentSlug}/player/{slug}",
    }).getAudioEmbedUrl(
      { slug: "test-story", shows: [{ sys: { id: "show-1" } }] },
      ctx
    );
    expect(url).toBe("https://example.com/my-show/player/test-story");
  });
});

// ---------------------------------------------------------------------------
// Linked-entry resolvers
// ---------------------------------------------------------------------------

describe("getBylines", () => {
  it("resolves names from hosts and reporters", async () => {
    entries.set("h1", {
      id: "h1",
      contentType: "host",
      fields: { name: "Host Name" },
    });
    entries.set("r1", {
      id: "r1",
      contentType: "reporter",
      fields: { name: "Reporter Name" },
    });
    const bylines = await adapter().getBylines(
      { hosts: [{ sys: { id: "h1" } }], reporters: [{ sys: { id: "r1" } }] },
      ctx
    );
    expect(bylines).toEqual(["Host Name", "Reporter Name"]);
  });

  it("skips entries without name", async () => {
    entries.set("h1", { id: "h1", contentType: "host", fields: {} });
    entries.set("r1", {
      id: "r1",
      contentType: "reporter",
      fields: { name: "Reporter Name" },
    });
    const bylines = await adapter().getBylines(
      { hosts: [{ sys: { id: "h1" } }], reporters: [{ sys: { id: "r1" } }] },
      ctx
    );
    expect(bylines).toEqual(["Reporter Name"]);
  });

  it("returns empty array when none linked", async () => {
    expect(
      await adapter().getBylines({ hosts: [], reporters: [] }, ctx)
    ).toEqual([]);
  });
});

describe("getImage", () => {
  it("resolves photo entry + asset", async () => {
    setPhoto("p1", "a1", {
      altText: "Alt text",
      photoCaption: "Caption text",
      photoCredit: "Producer",
      rightsHolder: "Provider",
    });
    setAsset("a1", "https://example.com/photo.jpg", 800, 600, "Photo Title");

    const image = await adapter().getImage(
      { primaryImage: { sys: { id: "p1" } } },
      ctx
    );
    expect(image).toEqual({
      url: "https://example.com/photo.jpg",
      altText: "Alt text",
      width: 800,
      height: 600,
      caption: "Caption text",
      producer: "Producer",
      provider: "Provider",
    });
  });

  it("returns undefined when no image linked", async () => {
    expect(await adapter().getImage({}, ctx)).toBeUndefined();
  });

  it("returns undefined when photo entry missing", async () => {
    entries.set("p1", null);
    const image = await adapter().getImage(
      { primaryImage: { sys: { id: "p1" } } },
      ctx
    );
    expect(image).toBeUndefined();
  });

  it("falls back to asset title for altText", async () => {
    setPhoto("p1", "a1");
    setAsset("a1", "https://example.com/photo.jpg", 800, 600, "Asset Title");
    const image = await adapter().getImage(
      { primaryImage: { sys: { id: "p1" } } },
      ctx
    );
    expect(image?.altText).toBe("Asset Title");
  });
});

describe("getAudio", () => {
  it("resolves audio with embed URL", async () => {
    setMediaLink("a1", {
      mediaUrl: "https://example.com/audio.mp3",
      duration: "180",
    });
    const audio = await adapter({
      audioEmbedUrlTemplate: "https://example.com/player/{slug}",
    }).getAudio({ audioMedia: { sys: { id: "a1" } }, slug: "test-story" }, ctx);
    expect(audio).toMatchObject({
      url: "https://example.com/audio.mp3",
      duration: 180,
      embedUrl: "https://example.com/player/test-story",
    });
  });

  it("returns undefined when no audio linked", async () => {
    expect(await adapter().getAudio({}, ctx)).toBeUndefined();
  });

  it("includes default rels", async () => {
    setMediaLink("a1", { mediaUrl: "https://example.com/audio.mp3" });
    const audio = await adapter().getAudio(
      { audioMedia: { sys: { id: "a1" } } },
      ctx
    );
    expect(audio?.rels).toEqual(["sponsored", "tracked"]);
  });
});

// ---------------------------------------------------------------------------
// resolveBodyEmbed dispatch (one row per supported KCRW content type)
// ---------------------------------------------------------------------------

describe("resolveBodyEmbed", () => {
  it("resolves photo embed", async () => {
    setPhoto("p1", "a1", { altText: "Photo alt" });
    setAsset("a1", "https://example.com/photo.jpg");
    const embed = await adapter().resolveBodyEmbed("p1", "photo", ctx);
    expect(embed).toMatchObject({
      type: "image",
      url: "https://example.com/photo.jpg",
      altText: "Photo alt",
    });
  });

  it("resolves htmlEmbed", async () => {
    entries.set("h1", {
      id: "h1",
      contentType: "htmlEmbed",
      fields: { embedCode: "<div>Custom HTML</div>" },
    });
    const embed = await adapter().resolveBodyEmbed("h1", "htmlEmbed", ctx);
    expect(embed).toEqual({ type: "html", html: "<div>Custom HTML</div>" });
  });

  it("returns unknown for htmlEmbed with no embedCode", async () => {
    entries.set("h1", { id: "h1", contentType: "htmlEmbed", fields: {} });
    expect(await adapter().resolveBodyEmbed("h1", "htmlEmbed", ctx)).toEqual({
      type: "unknown",
    });
  });

  it("resolves youtube mediaLink", async () => {
    setMediaLink("v", {
      mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      hosting: "youtube",
    });
    const embed = await adapter().resolveBodyEmbed("v", "mediaLink", ctx);
    expect(embed).toEqual({ type: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  it("resolves file video mediaLink", async () => {
    setMediaLink("v", {
      mediaUrl: "https://example.com/video.mp4",
      hosting: "file",
      duration: "120",
    });
    const embed = await adapter().resolveBodyEmbed("v", "mediaLink", ctx);
    expect(embed).toMatchObject({
      type: "video",
      url: "https://example.com/video.mp4",
      mimeType: "video/mp4",
      duration: 120,
    });
  });

  it("resolves audio mediaLink", async () => {
    setMediaLink("a1", {
      mediaUrl: "https://example.com/audio.mp3",
      duration: "180",
    });
    const embed = await adapter().resolveBodyEmbed("a1", "mediaLink", ctx);
    expect(embed).toMatchObject({
      type: "audio",
      url: "https://example.com/audio.mp3",
      duration: 180,
    });
  });

  it("returns unknown for unrecognized content type", async () => {
    expect(await adapter().resolveBodyEmbed("u1", "unknownType", ctx)).toEqual({
      type: "unknown",
    });
  });

  it("returns unknown for missing entry", async () => {
    entries.set("missing-1", null);
    expect(await adapter().resolveBodyEmbed("missing-1", "photo", ctx)).toEqual(
      {
        type: "unknown",
      }
    );
  });
});
