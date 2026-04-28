// Shared helpers for reasoning about NPR CDS publish state vs. Contentful
// entry version. The +2 accounts for `writeNprCDSData` doing update+publish
// after the user-initiated publish, bumping `publishedVersion` by 2.

type EntrySysLike = {
  version?: number;
  publishedVersion?: number | null;
};

export const isOutOfDateWithCDS = (
  sys: EntrySysLike,
  storedContentfulVersion: number | null | undefined
): boolean =>
  storedContentfulVersion != null &&
  sys.publishedVersion != null &&
  sys.publishedVersion > storedContentfulVersion + 2;

export const hasUnpublishedChanges = (sys: EntrySysLike): boolean =>
  sys.publishedVersion != null &&
  sys.version != null &&
  sys.version > sys.publishedVersion + 1;
