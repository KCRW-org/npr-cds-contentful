import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import { fetchStory, fetchCollection } from "../fetch";
import type { AppInstallationParameters } from "../../types";
import { mockOk } from "./helpers";

const params: AppInstallationParameters = {
  cdsAccessToken: "tok",
  cdsEnvironment: "staging",
};

describe("fetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("fetchStory", () => {
    it("returns undefined when CDS returns no resources (not found)", async () => {
      mockOk({ resources: [] });
      expect(await fetchStory("/v1/documents/missing", params)).toBeUndefined();
    });

    it("maps the first resource when present", async () => {
      mockOk({ resources: [{ id: "story-1", title: "A Story" }] });
      const result = await fetchStory("/v1/documents/story-1", params);
      expect(result?.nprId).toBe("story-1");
      expect(result?.title).toBe("A Story");
    });

    it("returns undefined without calling CDS when no access token", async () => {
      const result = await fetchStory("/v1/documents/x", {});
      expect(result).toBeUndefined();
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
  });

  describe("fetchCollection", () => {
    it("returns undefined when CDS returns no resources (not found)", async () => {
      mockOk({ resources: [] });
      expect(
        await fetchCollection("/v1/documents/missing", params)
      ).toBeUndefined();
    });

    it("maps the first resource when present", async () => {
      mockOk({ resources: [{ id: "coll-1", title: "A Collection" }] });
      const result = await fetchCollection("/v1/documents/coll-1", params);
      expect(result?.nprId).toBe("coll-1");
    });
  });
});
