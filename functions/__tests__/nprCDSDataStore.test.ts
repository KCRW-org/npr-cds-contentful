import { describe, it, beforeEach, expect, vi } from "vitest";
import {
  getNprCDSData,
  writeNprCDSData,
  clearNprCDSData,
  type CmaContext,
} from "../nprCDSDataStore";
import type { NprCDSData } from "../../src/types";
import type { EntryProps, PlainClientAPI } from "contentful-management";

const LOCALE = "en-US";

type EntryStub = {
  sys: { version: number; publishedVersion?: number | null };
  fields: Record<string, Record<string, unknown>>;
};

const makeCtx = (entry: EntryStub) => {
  const get = vi.fn().mockResolvedValue(entry as unknown as EntryProps);
  const update = vi
    .fn()
    .mockImplementation(async (_params, body) => body as EntryProps);
  const publish = vi
    .fn()
    .mockImplementation(async (_params, body) => body as EntryProps);
  const cma = {
    entry: { get, update, publish },
  } as unknown as PlainClientAPI;
  const ctx: CmaContext = { cma, spaceId: "S", environmentId: "E" };
  return { ctx, get, update, publish };
};

const makeData = (overrides: Partial<NprCDSData> = {}): NprCDSData => ({
  cdsDocumentId: "contentful-cds-abc",
  publishedAt: "2026-01-01T00:00:00.000Z",
  contentfulVersion: 4,
  collectionIds: [],
  ...overrides,
});

describe("nprCDSDataStore", () => {
  describe("getNprCDSData", () => {
    it("returns the parsed object and publishedVersion when present", async () => {
      const data = makeData({ collectionIds: ["319418027"] });
      const { ctx } = makeCtx({
        sys: { version: 5, publishedVersion: 4 },
        fields: { nprCDSData: { [LOCALE]: data } },
      });
      const result = await getNprCDSData("entry-1", LOCALE, ctx);
      expect(result).toEqual({ data, publishedVersion: 4 });
    });

    it("returns null data when the field is missing for the locale", async () => {
      const { ctx } = makeCtx({
        sys: { version: 1, publishedVersion: null },
        fields: {},
      });
      const result = await getNprCDSData("entry-1", LOCALE, ctx);
      expect(result.data).toBeNull();
    });

    it("parses a JSON string value", async () => {
      const data = makeData();
      const { ctx } = makeCtx({
        sys: { version: 5, publishedVersion: 4 },
        fields: { nprCDSData: { [LOCALE]: JSON.stringify(data) } },
      });
      const result = await getNprCDSData("entry-1", LOCALE, ctx);
      expect(result.data).toEqual(data);
    });

    it("returns null data on JSON parse failure", async () => {
      const { ctx } = makeCtx({
        sys: { version: 5, publishedVersion: 4 },
        fields: { nprCDSData: { [LOCALE]: "{not json" } },
      });
      const result = await getNprCDSData("entry-1", LOCALE, ctx);
      expect(result.data).toBeNull();
      expect(result.publishedVersion).toBe(4);
    });
  });

  describe("writeNprCDSData", () => {
    it("updates and republishes when entry was clean (version === publishedVersion + 1)", async () => {
      const entry: EntryStub = {
        sys: { version: 5, publishedVersion: 4 },
        fields: {},
      };
      const { ctx, get, update, publish } = makeCtx(entry);
      const data = makeData();
      await writeNprCDSData("entry-1", LOCALE, data, ctx);

      expect(get).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledOnce();
      const [, body] = update.mock.calls[0];
      expect(body.fields.nprCDSData[LOCALE]).toEqual(data);
      expect(publish).toHaveBeenCalledOnce();
    });

    it("uses prefetched entry instead of fetching", async () => {
      const entry: EntryStub = {
        sys: { version: 5, publishedVersion: 4 },
        fields: {},
      };
      const { ctx, get, update, publish } = makeCtx({
        sys: { version: 99, publishedVersion: 99 }, // never fetched
        fields: {},
      });
      await writeNprCDSData(
        "entry-1",
        LOCALE,
        makeData(),
        ctx,
        entry as unknown as EntryProps
      );
      expect(get).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledOnce();
      expect(publish).toHaveBeenCalledOnce();
    });

    it.each([
      ["entry has unpublished drafts", { version: 7, publishedVersion: 4 }],
      [
        "entry has never been published",
        { version: 1, publishedVersion: null },
      ],
    ] as const)("skips auto-publish when %s", async (_name, sys) => {
      const { ctx, update, publish } = makeCtx({ sys, fields: {} });
      await writeNprCDSData("entry-1", LOCALE, makeData(), ctx);
      expect(update).toHaveBeenCalledOnce();
      expect(publish).not.toHaveBeenCalled();
    });

    it("preserves other locales when writing", async () => {
      const { ctx, update } = makeCtx({
        sys: { version: 5, publishedVersion: 4 },
        fields: { nprCDSData: { "es-US": { keep: "me" } } },
      });
      await writeNprCDSData("entry-1", LOCALE, makeData(), ctx);
      const body = update.mock.calls[0][1];
      expect(body.fields.nprCDSData["es-US"]).toEqual({ keep: "me" });
      expect(body.fields.nprCDSData[LOCALE]).toBeDefined();
    });

    it("swallows publish failures (warns) without throwing", async () => {
      const entry: EntryStub = {
        sys: { version: 5, publishedVersion: 4 },
        fields: {},
      };
      const { ctx } = makeCtx(entry);
      (ctx.cma.entry.publish as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("publish boom")
      );
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(
        writeNprCDSData("entry-1", LOCALE, makeData(), ctx)
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe("clearNprCDSData", () => {
    it("removes the locale key and republishes when clean", async () => {
      const data = makeData();
      const { ctx, update, publish } = makeCtx({
        sys: { version: 5, publishedVersion: 4 },
        fields: { nprCDSData: { [LOCALE]: data, "es-US": { other: 1 } } },
      });
      await clearNprCDSData("entry-1", LOCALE, ctx);
      const body = update.mock.calls[0][1];
      expect(body.fields.nprCDSData[LOCALE]).toBeUndefined();
      expect(body.fields.nprCDSData["es-US"]).toEqual({ other: 1 });
      expect(publish).toHaveBeenCalledOnce();
    });

    it("does not republish when publishedVersion is null (unpublished entry)", async () => {
      const { ctx, update, publish } = makeCtx({
        sys: { version: 5, publishedVersion: null },
        fields: { nprCDSData: { [LOCALE]: makeData() } },
      });
      await clearNprCDSData("entry-1", LOCALE, ctx);
      expect(update).toHaveBeenCalledOnce();
      expect(publish).not.toHaveBeenCalled();
    });
  });
});
