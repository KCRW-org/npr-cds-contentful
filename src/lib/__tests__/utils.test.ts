import { describe, it, beforeEach, vi, expect, afterEach } from "vitest";
import {
  idFromURN,
  fetchByURN,
  queryCDS,
  storyLookupForStory,
  collectionLookupForCollection,
  cleanupLookupItem,
} from "../utils";
import type { Story, Collection } from "../../types";
import { mockOk } from "./helpers";

const makeStory = (overrides: Partial<Story> = {}): Story => ({
  id: "story-x",
  title: "Story",
  teaser: "Description",
  publishDateTime: "2024-01-15T10:00:00Z",
  profiles: [],
  brandings: [],
  owners: [],
  images: [],
  assets: {},
  ...overrides,
});

const makeCollection = (overrides: Partial<Collection> = {}): Collection => ({
  id: "coll-x",
  title: "Collection",
  items: [],
  profiles: [],
  images: [],
  assets: {},
  ...overrides,
});

const PUBLISHABLE_PROFILE = [{ href: "/v1/profiles/publishable" }];

describe("utils", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("idFromURN", () => {
    it.each([
      ["/v1/documents/123", "123"],
      ["/v1/documents/abc-def", "abc-def"],
      ["/v1/stories/456/images/789", "789"],
      ["simple", "simple"],
      ["/", ""],
    ])("extracts %s → %s", (urn, expected) => {
      expect(idFromURN(urn)).toBe(expected);
    });
  });

  describe("fetchByURN", () => {
    it("hits staging by default with Bearer token, returns resources[]", async () => {
      mockOk({ resources: [{ id: "test123" }] });
      const result = await fetchByURN(
        "/v1/documents/test123",
        "mytoken",
        "staging"
      );

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "https://stage-content.api.npr.org/v1/documents/test123",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mytoken",
          },
        }
      );
      expect(result).toEqual([{ id: "test123" }]);
    });

    it.each([
      ["production", "production", /content\.api\.npr\.org/],
      [
        "undefined defaults to staging",
        undefined,
        /stage-content\.api\.npr\.org/,
      ],
    ])(
      "environment=%s uses correct base URL",
      async (_name, env, urlPattern) => {
        mockOk({ resources: [] });
        await fetchByURN(
          "/v1/documents/x",
          "t",
          env as "production" | undefined
        );
        expect(vi.mocked(fetch).mock.calls[0][0]).toMatch(urlPattern);
      }
    );
  });

  describe("queryCDS", () => {
    it("constructs /v1/documents query URL with Bearer token", async () => {
      mockOk({ resources: [] });
      const params = new URLSearchParams({ searchKey: "test" });
      await queryCDS(params, "token", "staging", false);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toMatch(/stage-content\.api\.npr\.org\/v1\/documents\?/);
      expect(url).toContain("searchKey=test");
      expect(init).toEqual({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      });
    });

    it.each([
      ["appends profileIds=has-images when requireImages=true", true, true],
      ["omits profileIds when requireImages=false", false, false],
    ])("%s", async (_name, requireImages, shouldContain) => {
      mockOk({ resources: [] });
      await queryCDS(new URLSearchParams(), "token", "staging", requireImages);
      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url.includes("profileIds=has-images")).toBe(shouldContain);
    });

    it("uses production base URL when environment='production'", async () => {
      mockOk({ resources: [] });
      await queryCDS(new URLSearchParams(), "token", "production", false);
      expect(vi.mocked(fetch).mock.calls[0][0]).toMatch(
        /content\.api\.npr\.org/
      );
    });
  });

  describe("storyLookupForStory", () => {
    it("maps minimal story fields", () => {
      const result = storyLookupForStory(
        makeStory({
          id: "story-123",
          title: "Test Story",
          subtitle: "Test Subtitle",
          teaser: "Test description",
        })
      );
      expect(result).toMatchObject({
        nprId: "story-123",
        urn: "/v1/documents/story-123",
        title: "Test Story",
        subtitle: "Test Subtitle",
        description: "Test description",
        publishDateTime: "2024-01-15T10:00:00Z",
      });
      expect(result.sys?.id).toBe("/v1/documents/story-123");
    });

    it("falls back to shortTeaser when subtitle missing", () => {
      const result = storyLookupForStory(
        makeStory({ shortTeaser: "Short teaser text" })
      );
      expect(result.subtitle).toBe("Short teaser text");
    });

    it("extracts primary image from images + assets", () => {
      const result = storyLookupForStory(
        makeStory({
          images: [{ href: "/v1/images/img-001", rels: ["primary"] }],
          assets: {
            "img-001": {
              id: "img-001",
              profiles: [],
              altText: "Test image",
              enclosures: [
                {
                  href: "https://example.com/image.jpg",
                  type: "image/jpeg",
                  rels: ["primary"],
                },
              ],
            },
          },
        })
      );
      expect(result.image).toMatchObject({
        url: "https://example.com/image.jpg",
        altText: "Test image",
      });
    });

    it("extracts primary audio from audio + assets", () => {
      const result = storyLookupForStory(
        makeStory({
          audio: [{ href: "/v1/audio/audio-001", rels: ["primary"] }],
          assets: {
            "audio-001": {
              id: "audio-001",
              profiles: [],
              duration: 3600,
              isAvailable: true,
              isStreamable: true,
              enclosures: [
                { href: "https://example.com/audio.mp3", type: "audio/mpeg" },
              ],
            },
          },
        })
      );
      expect(result.audio).toMatchObject({
        url: "https://example.com/audio.mp3",
        duration: 3600,
      });
    });

    it("includes canonical webPage as externalUrl", () => {
      const result = storyLookupForStory(
        makeStory({
          webPages: [{ href: "https://npr.org/story", rels: ["canonical"] }],
        })
      );
      expect(result.externalUrl).toBe("https://npr.org/story");
    });
  });

  describe("collectionLookupForCollection", () => {
    it("creates basic lookup with nprId and urn", () => {
      const result = collectionLookupForCollection(
        makeCollection({ id: "coll-123", title: "Collection Title" })
      );
      expect(result).toMatchObject({
        nprId: "coll-123",
        urn: "/v1/documents/coll-123",
      });
      expect(result.sys?.id).toBe("/v1/documents/coll-123");
    });

    it("populates metadata when publishable profile exists", () => {
      const result = collectionLookupForCollection(
        makeCollection({
          title: "Published Collection",
          subtitle: "Subtitle",
          teaser: "Description",
          publishDateTime: "2024-01-20T10:00:00Z",
          profiles: PUBLISHABLE_PROFILE,
        })
      );
      expect(result).toMatchObject({
        title: "Published Collection",
        subtitle: "Subtitle",
        description: "Description",
        publishDateTime: "2024-01-20T10:00:00Z",
      });
    });

    it("falls back to shortTeaser when subtitle missing (publishable)", () => {
      const result = collectionLookupForCollection(
        makeCollection({
          shortTeaser: "Short version",
          profiles: PUBLISHABLE_PROFILE,
        })
      );
      expect(result.subtitle).toBe("Short version");
    });

    it("uses default title when no publishable profile", () => {
      const result = collectionLookupForCollection(
        makeCollection({
          id: "coll-draft",
          title: "Draft Collection",
          profiles: [{ href: "/v1/profiles/other" }],
        })
      );
      expect(result.title).toBe("NPR Collection coll-draft");
      expect(result.subtitle).toBeUndefined();
    });

    it("includes canonical webPage when publishable", () => {
      const result = collectionLookupForCollection(
        makeCollection({
          profiles: PUBLISHABLE_PROFILE,
          webPages: [
            { href: "https://npr.org/collection", rels: ["canonical"] },
          ],
        })
      );
      expect(result.externalUrl).toBe("https://npr.org/collection");
    });

    it("extracts primary image when publishable", () => {
      const result = collectionLookupForCollection(
        makeCollection({
          profiles: PUBLISHABLE_PROFILE,
          images: [{ href: "/v1/images/coll-img-001", rels: ["primary"] }],
          assets: {
            "coll-img-001": {
              id: "coll-img-001",
              profiles: [],
              altText: "Collection image",
              enclosures: [
                {
                  href: "https://example.com/coll.jpg",
                  type: "image/jpeg",
                  rels: ["primary"],
                },
              ],
            },
          },
        })
      );
      expect(result.image?.url).toBe("https://example.com/coll.jpg");
    });
  });

  describe("cleanupLookupItem", () => {
    const baseItem = (extra: Record<string, unknown> = {}) =>
      ({
        nprId: "x",
        sys: { id: "x" },
        urn: "/v1/documents/x",
        title: "Item",
        ...extra,
      }) as any;

    it.each([
      ["null image", { image: null }],
      ["image without url", { image: { altText: "No URL" } }],
    ])("normalizes %s to empty image", (_name, extra) => {
      expect(cleanupLookupItem(baseItem(extra)).image).toEqual({
        url: "",
        altText: "",
      });
    });

    it("preserves image when url present", () => {
      const result = cleanupLookupItem(
        baseItem({
          image: { url: "https://example.com/img.jpg", altText: "Alt" },
        })
      );
      expect(result.image).toEqual({
        url: "https://example.com/img.jpg",
        altText: "Alt",
      });
    });

    it.each([
      [
        "description as fallback",
        { description: "Item description" },
        "Item description",
      ],
      ["empty string when both missing", {}, ""],
      [
        "preserves existing subtitle",
        { subtitle: "Existing", description: "D" },
        "Existing",
      ],
    ])("subtitle: %s", (_name, extra, expected) => {
      const result = cleanupLookupItem(
        baseItem({ image: { url: "", altText: "" }, ...extra })
      );
      expect(result.subtitle).toBe(expected);
    });
  });
});
