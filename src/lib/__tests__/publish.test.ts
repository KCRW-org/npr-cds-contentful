import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";
import type { Document } from "@contentful/rich-text-types";
import {
  markdownToPlainText,
  buildLayoutFromRichText,
  buildCdsDocument,
  checkCdsPublishStatus,
  publishStoryToCds,
  NPR_ONE_LOCAL_COLLECTION_ID,
  NPR_ONE_FEATURED_COLLECTION_ID,
} from "../publish";
import type { ResolvedEmbedEntry, CdsStoryDocumentInput } from "../../types";
import { docOf, embeddedEntry, mockOk, mockErr } from "./helpers";

const paragraph = (...content: Array<Record<string, unknown>>) =>
  ({
    nodeType: BLOCKS.PARAGRAPH,
    data: {},
    content,
  }) as unknown as Document["content"][number];

const text = (value: string) => ({
  nodeType: "text",
  data: {},
  value,
  marks: [],
});

const refAssetId = (href: string | undefined) =>
  href?.replace(/^#\/assets\//, "") ?? "";

const minimalDoc = (
  extra: Record<string, unknown> = {}
): CdsStoryDocumentInput => ({
  id: "contentful-cds-story-1",
  title: "Test",
  profiles: [],
  collections: [],
  owners: [],
  brandings: [],
  assets: {},
  ...extra,
});

const mockJsonError = (status = 200): void => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => {
      throw new Error("Invalid JSON");
    },
  } as unknown as Response);
};

// ---------------------------------------------------------------------------
// markdownToPlainText
// ---------------------------------------------------------------------------

describe("markdownToPlainText", () => {
  it("returns empty string for empty input", () => {
    expect(markdownToPlainText("")).toBe("");
  });

  it("strips markdown formatting", () => {
    expect(
      markdownToPlainText("# Heading\n\nParagraph with **bold** and *italic*.")
    ).toMatch(/Heading.+Paragraph with bold and italic/);
  });

  it("collapses whitespace and trims", () => {
    expect(markdownToPlainText("   Line 1\n\n\nLine 2  \t  Line 3   ")).toBe(
      "Line 1 Line 2 Line 3"
    );
  });
});

// ---------------------------------------------------------------------------
// buildLayoutFromRichText
// ---------------------------------------------------------------------------

describe("buildLayoutFromRichText", () => {
  const embeds: Record<string, ResolvedEmbedEntry> = {
    image: {
      type: "image",
      url: "https://example.com/photo.jpg",
      altText: "Test photo",
      width: 800,
      height: 600,
    },
    audio: {
      type: "audio",
      url: "https://example.com/audio.mp3",
      duration: 180,
    },
    youtube: { type: "youtube", videoId: "dQw4w9WgXcQ" },
    video: {
      type: "video",
      url: "https://example.com/video.mp4",
      mimeType: "video/mp4",
      duration: 120,
    },
    html: { type: "html", html: "<div>Embedded content</div>" },
  };

  it("renders paragraph text to a text asset with rendered HTML", () => {
    const { refs, layoutAssets } = buildLayoutFromRichText(
      docOf(paragraph(text("Hello world"))),
      new Map()
    );
    expect(refs).toEqual([{ href: "#/assets/layout-text-0" }]);
    const asset = layoutAssets["layout-text-0"] as Record<string, unknown>;
    expect(asset.text).toMatch(/Hello world/);
    expect(asset.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/v1/profiles/text" }),
      ])
    );
  });

  it("maps a solo-hyperlink paragraph to an external-link asset with title", () => {
    const doc = docOf(
      paragraph({
        nodeType: INLINES.HYPERLINK,
        data: { uri: "https://example.com" },
        content: [text("Click here")],
      })
    );
    const { refs, layoutAssets } = buildLayoutFromRichText(doc, new Map());
    expect(refs).toHaveLength(1);
    const asset = layoutAssets[refAssetId(refs[0].href)] as Record<
      string,
      unknown
    >;
    expect(asset).toMatchObject({
      externalLink: "https://example.com",
      title: "Click here",
      profiles: expect.arrayContaining([
        expect.objectContaining({ href: "/v1/profiles/external-link" }),
      ]),
    });
  });

  // Each row asserts: which profile URN identifies the asset's type, plus a
  // type-specific field that proves the embed payload reached the asset.
  it.each<[string, keyof typeof embeds, string, [string, unknown]]>([
    ["photo", "image", "/v1/profiles/image", ["altText", "Test photo"]],
    ["audio", "audio", "/v1/profiles/audio", ["duration", 180]],
    [
      "youtube",
      "youtube",
      "/v1/profiles/youtube-video",
      ["externalId", "dQw4w9WgXcQ"],
    ],
    ["video file", "video", "/v1/profiles/video", ["duration", 120]],
    [
      "html",
      "html",
      "/v1/profiles/html-block",
      ["html", "<div>Embedded content</div>"],
    ],
  ])(
    "maps %s embed to asset with profile %s",
    (_name, embedKey, profileHref, [field, value]) => {
      const map = new Map([["e1", embeds[embedKey]]]);
      const { refs, layoutAssets } = buildLayoutFromRichText(
        docOf(embeddedEntry("e1")),
        map
      );
      expect(refs).toHaveLength(1);
      const asset = layoutAssets[refAssetId(refs[0].href)] as Record<
        string,
        unknown
      >;
      expect(asset.profiles).toEqual(
        expect.arrayContaining([expect.objectContaining({ href: profileHref })])
      );
      expect(asset[field]).toEqual(value);
    }
  );

  it("skips unknown embed types", () => {
    const map = new Map<string, ResolvedEmbedEntry>([
      ["u1", { type: "unknown" }],
    ]);
    const { refs, layoutAssets } = buildLayoutFromRichText(
      docOf(embeddedEntry("u1")),
      map
    );
    expect(refs).toEqual([]);
    expect(layoutAssets).toEqual({});
  });

  it("skips embeds whose target id is not in the resolved map", () => {
    const { refs } = buildLayoutFromRichText(
      docOf(embeddedEntry("missing")),
      new Map()
    );
    expect(refs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCdsDocument
// ---------------------------------------------------------------------------

describe("buildCdsDocument", () => {
  const buildDoc = (extras: Record<string, unknown> = {}) =>
    buildCdsDocument({ entryId: "story-1", title: "Test", ...extras });

  it("formats document ID as prefix-entryid-lowercase", () => {
    const doc = buildCdsDocument({
      entryId: "Story-ABC",
      title: "Test",
      cdsDocumentPrefix: "contentful-cds",
    });
    expect(doc.id).toBe("contentful-cds-story-abc");
  });

  describe("collections", () => {
    it("includes LOCAL collection by default", () => {
      expect(buildDoc().collections).toEqual([
        expect.objectContaining({
          href: `/v1/documents/${NPR_ONE_LOCAL_COLLECTION_ID}`,
        }),
      ]);
    });

    it("includes FEATURED when specified alongside LOCAL", () => {
      const doc = buildDoc({
        collectionIds: [
          NPR_ONE_LOCAL_COLLECTION_ID,
          NPR_ONE_FEATURED_COLLECTION_ID,
        ],
      });
      expect(doc.collections).toHaveLength(2);
    });

    it("merges additionalCollections", () => {
      const doc = buildDoc({
        additionalCollections: [
          { href: "/v1/documents/custom-id", rels: ["custom"] },
        ],
      });
      expect(doc.collections).toContainEqual({
        href: "/v1/documents/custom-id",
        rels: ["custom"],
      });
    });
  });

  describe("profiles", () => {
    it.each([
      [
        "image",
        { image: { url: "https://x/p.jpg", width: 800, height: 600 } },
        ["/v1/profiles/has-images"],
      ],
      [
        "audio",
        { audio: { url: "https://x/a.mp3", duration: 180 } },
        ["/v1/profiles/has-audio", "/v1/profiles/listenable"],
      ],
      [
        "youtube video",
        { video: { type: "youtube", videoId: "abc123" } },
        ["/v1/profiles/has-videos"],
      ],
    ])("adds %s-related profiles when present", (_name, params, hrefs) => {
      const doc = buildDoc(params);
      for (const href of hrefs) {
        expect(doc.profiles).toEqual(
          expect.arrayContaining([expect.objectContaining({ href })])
        );
      }
    });
  });

  describe("video asset", () => {
    it("builds youtube asset with externalId and youtube-video profile", () => {
      const doc = buildDoc({ video: { type: "youtube", videoId: "abc123" } });
      expect(doc.assets["video-story-1"]).toMatchObject({
        externalId: "abc123",
        profiles: expect.arrayContaining([
          expect.objectContaining({ href: "/v1/profiles/youtube-video" }),
        ]),
      });
      expect(doc.videos).toEqual([
        { href: "#/assets/video-story-1", rels: ["primary"] },
      ]);
    });

    it("builds file video asset with mime/duration and isStreamable=false", () => {
      const doc = buildDoc({
        video: {
          type: "video/mp4",
          url: "https://example.com/v.mp4",
          duration: 90,
        },
      });
      expect(doc.assets["video-story-1"]).toMatchObject({
        isStreamable: false,
        isDownloadable: false,
        isAvailable: true,
        duration: 90,
        profiles: expect.arrayContaining([
          expect.objectContaining({ href: "/v1/profiles/video" }),
        ]),
        enclosures: [
          expect.objectContaining({
            href: "https://example.com/v.mp4",
            type: "video/mp4",
          }),
        ],
      });
    });
  });

  it("calculates recommendUntilDateTime as publishDateTime + recommendUntilDays", () => {
    const doc = buildDoc({
      publishDateTime: "2026-04-24T12:00:00Z",
      recommendUntilDays: 7,
    });
    expect(doc.recommendUntilDateTime).toBe("2026-05-01T12:00:00.000Z");
  });

  it("builds audio asset keyed audio-{entryId} with duration and isAvailable", () => {
    const doc = buildDoc({
      audio: { url: "https://example.com/audio.mp3", duration: 180 },
    });
    expect(doc.assets["audio-story-1"]).toMatchObject({
      isAvailable: true,
      duration: 180,
      enclosures: [
        expect.objectContaining({ href: "https://example.com/audio.mp3" }),
      ],
    });
    expect(doc.audio).toEqual([
      { href: "#/assets/audio-story-1", rels: ["headline", "primary"] },
    ]);
  });

  describe("nprServiceId", () => {
    it("populates owners/brandings/authorizedOrgServiceIds when provided", () => {
      const doc = buildDoc({ nprServiceId: "12345" });
      const expectedHref = "https://organization.api.npr.org/v4/services/12345";
      expect(doc.owners).toEqual([{ href: expectedHref }]);
      expect(doc.brandings).toEqual([{ href: expectedHref }]);
      expect(doc.authorizedOrgServiceIds).toEqual(["12345"]);
    });

    it("leaves them empty when not provided", () => {
      const doc = buildDoc();
      expect(doc.owners).toEqual([]);
      expect(doc.brandings).toEqual([]);
      expect(doc.authorizedOrgServiceIds).toEqual([]);
    });
  });

  it("creates byline assets and references for each name", () => {
    const doc = buildDoc({ bylines: ["Jane Doe", "John Smith"] });
    expect(doc.assets["byline-0"]).toMatchObject({ name: "Jane Doe" });
    expect(doc.assets["byline-1"]).toMatchObject({ name: "John Smith" });
    expect(doc.bylines).toEqual([
      { href: "#/assets/byline-0" },
      { href: "#/assets/byline-1" },
    ]);
  });

  describe("layout", () => {
    const layoutWithRefs = {
      refs: [{ href: "#/assets/layout-text-0" }],
      layoutAssets: {
        "layout-text-0": { id: "layout-text-0", text: "<p>x</p>" },
      },
    };

    it("prepends primary image when both image and layout content present", () => {
      const doc = buildDoc({
        image: { url: "https://example.com/p.jpg", width: 1200, height: 800 },
        layout: layoutWithRefs,
      });
      expect(doc.layout).toEqual([
        { href: "#/assets/img-story-1" },
        { href: "#/assets/layout-text-0" },
      ]);
    });

    it("does not prepend primary image when layout has no refs", () => {
      const doc = buildDoc({
        image: { url: "https://example.com/p.jpg", width: 1200, height: 800 },
        layout: { refs: [], layoutAssets: {} },
      });
      expect(doc.layout).toEqual([]);
    });

    it("merges layout assets into doc.assets", () => {
      const doc = buildDoc({ layout: layoutWithRefs });
      expect(doc.assets["layout-text-0"]).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// checkCdsPublishStatus
// ---------------------------------------------------------------------------

describe("checkCdsPublishStatus", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns true on 200", async () => {
    mockOk();
    const result = await checkCdsPublishStatus(
      "story-1",
      "tok",
      "https://content.api.npr.org",
      "contentful-cds"
    );
    expect(result).toBe(true);
  });

  it("returns false on 404", async () => {
    mockErr(404);
    const result = await checkCdsPublishStatus(
      "story-1",
      "tok",
      "https://content.api.npr.org",
      "contentful-cds"
    );
    expect(result).toBe(false);
  });

  it("constructs URL with prefix-{lowercased-entryId} and Bearer auth", async () => {
    mockOk();
    await checkCdsPublishStatus(
      "Story-ABC",
      "tok",
      "https://content.api.npr.org",
      "custom-prefix"
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://content.api.npr.org/v1/documents/custom-prefix-story-abc",
      { headers: { Authorization: "Bearer tok" } }
    );
  });
});

// ---------------------------------------------------------------------------
// publishStoryToCds
// ---------------------------------------------------------------------------

describe("publishStoryToCds", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("PUTs document JSON to /v1/documents/{id} with Bearer auth", async () => {
    mockOk({ success: true }, 201);
    const doc = minimalDoc({ title: "Test Story" });
    const result = await publishStoryToCds(
      doc,
      "tok",
      "https://content.api.npr.org"
    );

    expect(result).toMatchObject({ ok: true, status: 201 });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://content.api.npr.org/v1/documents/contentful-cds-story-1",
      expect.objectContaining({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok",
        },
        body: expect.stringContaining("Test Story"),
      })
    );
  });

  it("returns parsed JSON body on success", async () => {
    const body = { id: "doc-1", status: "published" };
    mockOk(body);
    const result = await publishStoryToCds(minimalDoc(), "tok");
    expect(result.body).toEqual(body);
  });

  it("returns body=null when response JSON parsing fails", async () => {
    mockJsonError();
    const result = await publishStoryToCds(minimalDoc(), "tok");
    expect(result).toMatchObject({ ok: true, body: null });
  });

  it("propagates non-OK status", async () => {
    mockErr(500, { error: "Internal" });
    const result = await publishStoryToCds(minimalDoc(), "tok");
    expect(result).toMatchObject({ ok: false, status: 500 });
  });
});
