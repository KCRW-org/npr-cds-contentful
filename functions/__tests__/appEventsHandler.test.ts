import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { appEventsHandler } from "../appEventsHandler";
import type { PlainClientAPI, EntryProps } from "contentful-management";

const TOKEN = "cds-token";

type EntryStub = {
  sys: { version: number; publishedVersion?: number | null };
  fields: Record<string, Record<string, unknown>>;
};

const makeCma = (entry: EntryStub) => {
  const get = vi.fn().mockResolvedValue(entry as unknown as EntryProps);
  const update = vi
    .fn()
    .mockImplementation(async (_p, body) => body as EntryProps);
  const publish = vi
    .fn()
    .mockImplementation(async (_p, body) => body as EntryProps);
  return {
    cma: { entry: { get, update, publish } } as unknown as PlainClientAPI,
    get,
    update,
    publish,
  };
};

const makeContext = (
  entry: EntryStub,
  paramOverrides: Record<string, unknown> = {}
) => {
  const { cma, get, update, publish } = makeCma(entry);
  return {
    ctx: {
      cma,
      spaceId: "S",
      environmentId: "E",
      appInstallationParameters: {
        cdsAccessToken: TOKEN,
        cdsEnvironment: "staging" as const,
        cdsDocumentPrefix: "contentful-cds",
        locale: "en-US",
        ...paramOverrides,
      },
    },
    get,
    update,
    publish,
  };
};

const evt = (
  topic: string | undefined,
  body: Record<string, unknown> = { sys: { id: "entry-1" } }
) =>
  ({
    headers: topic ? { "x-contentful-topic": topic } : {},
    body,
    // The handler only reads headers/body — runtime fields not relevant.
  }) as unknown as Parameters<typeof appEventsHandler>[0];

describe("appEventsHandler", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => "",
      } as Response)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("ignores unrelated topics", async () => {
    const { ctx } = makeContext({
      sys: { version: 5, publishedVersion: 4 },
      fields: {},
    });
    await appEventsHandler(
      evt("ContentManagement.Entry.publish"),
      ctx as Parameters<typeof appEventsHandler>[1]
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores events with no entry id", async () => {
    const { ctx } = makeContext({
      sys: { version: 5, publishedVersion: 4 },
      fields: {},
    });
    await appEventsHandler(
      evt("ContentManagement.Entry.unpublish", {}),
      ctx as Parameters<typeof appEventsHandler>[1]
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("on unpublish: deletes the stored CDS document and clears the field", async () => {
    const { ctx, update, publish } = makeContext({
      sys: { version: 5, publishedVersion: null }, // already unpublished
      fields: {
        nprCDSData: {
          "en-US": {
            cdsDocumentId: "contentful-cds-stored-id",
            publishedAt: "2026-01-01T00:00:00Z",
            contentfulVersion: 4,
            collectionIds: [],
          },
        },
      },
    });

    await appEventsHandler(
      evt("ContentManagement.Entry.unpublish"),
      ctx as Parameters<typeof appEventsHandler>[1]
    );

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      "https://stage-content.api.npr.org/v1/documents/contentful-cds-stored-id"
    );
    expect(init).toMatchObject({
      method: "DELETE",
      headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
    });

    // Field cleared via update; not republished because publishedVersion is null
    expect(update).toHaveBeenCalledOnce();
    expect(publish).not.toHaveBeenCalled();
  });

  it("falls back to derived document id when stored data is absent", async () => {
    const { ctx } = makeContext({
      sys: { version: 5, publishedVersion: null },
      fields: {},
    });
    await appEventsHandler(
      evt("ContentManagement.Entry.unpublish", { sys: { id: "EnTrY-1" } }),
      ctx as Parameters<typeof appEventsHandler>[1]
    );
    const url = vi.mocked(fetch).mock.calls[0][0];
    expect(url).toBe(
      "https://stage-content.api.npr.org/v1/documents/contentful-cds-entry-1"
    );
  });

  it("uses production base URL when configured", async () => {
    const { ctx } = makeContext(
      { sys: { version: 5, publishedVersion: null }, fields: {} },
      { cdsEnvironment: "production" }
    );
    await appEventsHandler(
      evt("ContentManagement.Entry.unpublish"),
      ctx as Parameters<typeof appEventsHandler>[1]
    );
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/content\.api\.npr\.org\//);
  });

  it("on archive: deletes from CDS but does not update the (read-only) entry", async () => {
    const { ctx, update, publish } = makeContext({
      sys: { version: 5, publishedVersion: null },
      fields: {},
    });
    await appEventsHandler(
      evt("ContentManagement.Entry.archive"),
      ctx as Parameters<typeof appEventsHandler>[1]
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("warns but does not throw on non-204/404 CDS delete responses", async () => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "server error",
    } as Response);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ctx } = makeContext({
      sys: { version: 5, publishedVersion: null },
      fields: {},
    });
    await expect(
      appEventsHandler(
        evt("ContentManagement.Entry.unpublish"),
        ctx as Parameters<typeof appEventsHandler>[1]
      )
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("treats 404 from CDS as success (already deleted)", async () => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "not found",
    } as Response);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ctx } = makeContext({
      sys: { version: 5, publishedVersion: null },
      fields: {},
    });
    await appEventsHandler(
      evt("ContentManagement.Entry.unpublish"),
      ctx as Parameters<typeof appEventsHandler>[1]
    );
    // 404 means the doc is already gone — handler should treat as success and not warn.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("skips CDS delete when no cdsAccessToken is configured", async () => {
    const { ctx } = makeContext(
      { sys: { version: 5, publishedVersion: null }, fields: {} },
      { cdsAccessToken: undefined }
    );
    await appEventsHandler(
      evt("ContentManagement.Entry.unpublish"),
      ctx as Parameters<typeof appEventsHandler>[1]
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
