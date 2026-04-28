import { NPR_CDS_DATA_FIELD, type NprCDSData } from "../src/types";
import type { EntryProps, PlainClientAPI } from "contentful-management";

export type CmaContext = {
  cma: PlainClientAPI;
  spaceId: string;
  environmentId: string;
};

const FIELD_NAME = NPR_CDS_DATA_FIELD;

export async function getNprCDSData(
  entryId: string,
  locale: string,
  ctx: CmaContext
): Promise<{ data: NprCDSData | null; publishedVersion?: number }> {
  const entry = await ctx.cma.entry.get({
    spaceId: ctx.spaceId,
    environmentId: ctx.environmentId,
    entryId,
  });
  const publishedVersion = (entry.sys as { publishedVersion?: number })
    .publishedVersion;
  const raw = (entry.fields as Record<string, Record<string, unknown>>)[
    FIELD_NAME
  ]?.[locale];
  if (!raw) return { data: null, publishedVersion };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { data: parsed as NprCDSData, publishedVersion };
  } catch {
    return { data: null, publishedVersion };
  }
}

export async function writeNprCDSData(
  entryId: string,
  locale: string,
  data: NprCDSData,
  ctx: CmaContext,
  prefetchedEntry?: EntryProps
): Promise<void> {
  const entry =
    prefetchedEntry ??
    (await ctx.cma.entry.get({
      spaceId: ctx.spaceId,
      environmentId: ctx.environmentId,
      entryId,
    }));
  const sys = entry.sys as {
    version: number;
    publishedVersion?: number | null;
  };
  // Only republish if the entry was clean (published, no pending drafts) before
  // our field write. Callers (publishHandler) already validate this, but the
  // guard makes the helper safe to reuse without re-checking. A publish failure
  // here is non-fatal — the NPR CDS operation already succeeded.
  const wasClean =
    sys.publishedVersion != null && sys.version === sys.publishedVersion + 1;

  const fields = (entry.fields ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  if (!fields[FIELD_NAME]) fields[FIELD_NAME] = {};
  fields[FIELD_NAME][locale] = data;
  const updated = await ctx.cma.entry.update(
    { spaceId: ctx.spaceId, environmentId: ctx.environmentId, entryId },
    entry
  );
  if (!wasClean) return;
  try {
    await ctx.cma.entry.publish(
      { spaceId: ctx.spaceId, environmentId: ctx.environmentId, entryId },
      updated
    );
  } catch (publishErr) {
    console.warn(
      "[nprCDSDataStore] Entry update succeeded but auto-publish failed:",
      publishErr
    );
  }
}

export async function clearNprCDSData(
  entryId: string,
  locale: string,
  ctx: CmaContext
): Promise<void> {
  const entry = await ctx.cma.entry.get({
    spaceId: ctx.spaceId,
    environmentId: ctx.environmentId,
    entryId,
  });
  const sys = entry.sys as {
    version: number;
    publishedVersion?: number | null;
  };
  // Only republish if the entry was clean (published, no pending drafts) before
  // our field write. Otherwise our update would publish unrelated draft changes.
  const wasClean =
    sys.publishedVersion != null && sys.version === sys.publishedVersion + 1;

  const fields = (entry.fields ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  if (fields[FIELD_NAME]) {
    delete fields[FIELD_NAME][locale];
  }
  const updated = await ctx.cma.entry.update(
    { spaceId: ctx.spaceId, environmentId: ctx.environmentId, entryId },
    entry
  );
  if (!wasClean) return;
  try {
    await ctx.cma.entry.publish(
      { spaceId: ctx.spaceId, environmentId: ctx.environmentId, entryId },
      updated
    );
  } catch (publishErr) {
    console.warn(
      "[nprCDSDataStore] Entry update succeeded but auto-publish failed:",
      publishErr
    );
  }
}
