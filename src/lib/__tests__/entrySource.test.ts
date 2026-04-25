import { describe, it, beforeEach, vi, expect, afterEach } from "vitest";
import { createDeliveryEntrySource } from "../entrySource";
import { mockOk, mockErr } from "./helpers";

const makeSource = (
  overrides: Partial<Parameters<typeof createDeliveryEntrySource>[0]> = {}
) =>
  createDeliveryEntrySource({
    token: "token",
    spaceId: "space",
    environmentId: "master",
    locale: "en-US",
    ...overrides,
  });

const entry = (
  id: string,
  contentType: string,
  fields: Record<string, unknown> = {}
) => ({
  sys: { id, contentType: { sys: { id: contentType } } },
  fields,
});

const asset = (id: string, fields: Record<string, unknown>) => ({
  sys: { id },
  fields,
});

const link = (id: string, linkType: "Entry" | "Asset" = "Entry") => ({
  sys: { type: "Link", linkType, id },
});

describe("createDeliveryEntrySource", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("prime — request construction", () => {
    it("constructs CDA URL with spaceId, environmentId, locale, include depth, and Bearer token", async () => {
      mockOk({ items: [entry("entry-1", "story", { title: "T" })] });
      await makeSource({
        baseUrl: "https://cdn.contentful.com",
        token: "mytoken",
        spaceId: "space123",
      }).prime("entry-1", 2);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toContain("https://cdn.contentful.com/spaces/space123");
      expect(url).toContain("environments/master");
      expect(url).toContain("sys.id=entry-1");
      expect(url).toContain("include=2");
      expect(url).toContain("locale=en-US");
      expect(init).toEqual({ headers: { Authorization: "Bearer mytoken" } });
    });

    it("normalizes baseUrl (defaults to CDN, strips trailing slash)", async () => {
      mockOk({ items: [entry("e", "story")] });
      await makeSource().prime("e");
      expect(vi.mocked(fetch).mock.calls[0][0]).toContain(
        "https://cdn.contentful.com/spaces"
      );

      vi.mocked(fetch).mockClear();
      mockOk({ items: [entry("e", "story")] });
      await makeSource({ baseUrl: "https://custom.com/" }).prime("e");
      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain("https://custom.com/spaces");
      expect(url).not.toContain("https://custom.com//spaces");
    });

    it.each([
      ["clamps depth < 1 to 1", 0, 1],
      ["clamps depth > 10 to 10", 15, 10],
      ["passes depth in range", 5, 5],
      ["floors non-integer depth", 3.7, 3],
      ["defaults non-finite to 3", Infinity, 3],
      ["defaults undefined to 3", undefined, 3],
    ])("%s", async (_name, input, expected) => {
      mockOk({ items: [] });
      await makeSource().prime("e1", input as number | undefined);
      expect(vi.mocked(fetch).mock.calls[0][0]).toContain(
        `include=${expected}`
      );
    });
  });

  describe("prime — response normalization", () => {
    it("returns normalized entry with id, contentType, and locale-flat fields", async () => {
      mockOk({
        items: [
          entry("story-123", "story", { title: "My Story", slug: "my-story" }),
        ],
      });
      const result = await makeSource().prime("story-123");
      expect(result).toEqual({
        id: "story-123",
        contentType: "story",
        fields: { title: "My Story", slug: "my-story" },
      });
    });

    it.each([
      ["empty items", { items: [] }],
      ["null body", null],
    ])("returns null for %s", async (_name, body) => {
      mockOk(body);
      expect(await makeSource().prime("missing")).toBeNull();
    });

    it("caches primary entry and all included entries", async () => {
      mockOk({
        items: [entry("story-1", "story", { title: "S" })],
        includes: { Entry: [entry("author-1", "person", { name: "A" })] },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect((await source.getEntry("story-1"))?.id).toBe("story-1");
      expect((await source.getEntry("author-1"))?.id).toBe("author-1");
    });

    it("normalizes included assets with image dimensions and title", async () => {
      mockOk({
        items: [entry("story-1", "story")],
        includes: {
          Asset: [
            asset("img-1", {
              title: "My Image",
              file: {
                url: "https://example.com/image.jpg",
                details: { image: { width: 800, height: 600 } },
              },
            }),
          ],
        },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect(await source.getAsset("img-1")).toEqual({
        id: "img-1",
        url: "https://example.com/image.jpg",
        width: 800,
        height: 600,
        title: "My Image",
      });
    });

    it("converts protocol-relative asset URLs to https", async () => {
      mockOk({
        items: [entry("story-1", "story")],
        includes: {
          Asset: [
            asset("img-1", {
              file: { url: "//images.contentful.com/img.jpg" },
            }),
          ],
        },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect((await source.getAsset("img-1"))?.url).toBe(
        "https://images.contentful.com/img.jpg"
      );
    });

    it("returns null for assets with missing file.url", async () => {
      mockOk({
        items: [entry("story-1", "story")],
        includes: { Asset: [asset("img-bad", { title: "No File" })] },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect(await source.getAsset("img-bad")).toBeNull();
    });

    it("returns asset with undefined dimensions for non-image files", async () => {
      mockOk({
        items: [entry("story-1", "story")],
        includes: {
          Asset: [
            asset("doc-1", { file: { url: "https://example.com/doc.pdf" } }),
          ],
        },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect(await source.getAsset("doc-1")).toEqual({
        id: "doc-1",
        url: "https://example.com/doc.pdf",
        width: undefined,
        height: undefined,
        title: undefined,
      });
    });
  });

  describe("prime — link tracking", () => {
    it("caches null for unresolved links and warns", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockOk({
        items: [
          entry("story-1", "story", {
            author: link("author-1", "Entry"),
            image: link("img-1", "Asset"),
          }),
        ],
        includes: { Entry: [], Asset: [] },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect(await source.getEntry("author-1")).toBeNull();
      expect(await source.getAsset("img-1")).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[entrySource] prime(story-1, depth=3) left 1 entry and 1 asset references uncached"
        )
      );
      consoleSpy.mockRestore();
    });

    it("detects nested links inside linked entries", async () => {
      mockOk({
        items: [entry("story-1", "story", { author: link("author-1") })],
        includes: {
          Entry: [
            entry("author-1", "person", { photo: link("photo-1", "Asset") }),
          ],
          Asset: [
            asset("photo-1", {
              file: { url: "https://example.com/photo.jpg" },
            }),
          ],
        },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect((await source.getAsset("photo-1"))?.id).toBe("photo-1");
    });

    it("walks array fields containing links", async () => {
      mockOk({
        items: [
          entry("story-1", "story", { tags: [link("tag-1"), link("tag-2")] }),
        ],
        includes: {
          Entry: [
            entry("tag-1", "tag", { name: "Tag 1" }),
            entry("tag-2", "tag", { name: "Tag 2" }),
          ],
        },
      });
      const source = makeSource();
      await source.prime("story-1");
      expect((await source.getEntry("tag-1"))?.id).toBe("tag-1");
      expect((await source.getEntry("tag-2"))?.id).toBe("tag-2");
    });

    it("ignores malformed link objects", async () => {
      mockOk({
        items: [
          entry("story-1", "story", {
            metadata: { sys: { type: "Link" } }, // missing linkType + id
          }),
        ],
      });
      expect((await makeSource().prime("story-1"))?.id).toBe("story-1");
    });
  });

  describe("getEntry / getAsset", () => {
    it("returns cached values without re-fetching", async () => {
      mockOk({
        items: [entry("entry-1", "story", { title: "T" })],
        includes: {
          Asset: [
            asset("img-1", {
              title: "I",
              file: { url: "https://example.com/img.jpg" },
            }),
          ],
        },
      });
      const source = makeSource();
      await source.prime("entry-1");
      vi.mocked(fetch).mockClear();

      expect((await source.getEntry("entry-1"))?.id).toBe("entry-1");
      expect((await source.getAsset("img-1"))?.id).toBe("img-1");
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it("returns null for never-primed entries/assets without fetching", async () => {
      const source = makeSource();
      expect(await source.getEntry("never")).toBeNull();
      expect(await source.getAsset("never")).toBeNull();
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it.each([
      ["403", 403],
      ["502", 502],
    ])("throws on %s response", async (_name, status) => {
      mockErr(status);
      await expect(makeSource().prime("entry-1")).rejects.toThrow(
        new RegExp(`Contentful Delivery API error ${status}`)
      );
    });

    it("returns null on 404", async () => {
      mockErr(404);
      expect(await makeSource().prime("missing")).toBeNull();
    });
  });

  describe("cache isolation", () => {
    it("maintains separate caches per instance", async () => {
      mockOk({ items: [entry("entry-1", "story", { title: "Source 1" })] });
      mockOk({ items: [entry("entry-1", "story", { title: "Source 2" })] });
      const s1 = makeSource();
      const s2 = makeSource();
      await s1.prime("entry-1");
      await s2.prime("entry-1");
      expect((await s1.getEntry("entry-1"))?.fields.title).toBe("Source 1");
      expect((await s2.getEntry("entry-1"))?.fields.title).toBe("Source 2");
    });
  });
});
