import { vi } from "vitest";
import { BLOCKS } from "@contentful/rich-text-types";
import type { Document } from "@contentful/rich-text-types";

export const mockOk = (body: unknown = {}, status = 200): void => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => body,
  } as Response);
};

export const mockErr = (status: number, body: unknown = {}): void => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body,
  } as Response);
};

export const docOf = (...content: Document["content"]): Document => ({
  nodeType: BLOCKS.DOCUMENT,
  data: {},
  content,
});

export const embeddedEntry = (id: string) =>
  ({
    nodeType: BLOCKS.EMBEDDED_ENTRY,
    data: { target: { sys: { type: "Link", linkType: "Entry", id } } },
    content: [],
  }) as Document["content"][number];

export const embeddedAsset = (id: string) =>
  ({
    nodeType: BLOCKS.EMBEDDED_ASSET,
    data: { target: { sys: { type: "Link", linkType: "Asset", id } } },
    content: [],
  }) as Document["content"][number];
