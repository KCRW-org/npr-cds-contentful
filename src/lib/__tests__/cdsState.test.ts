import { describe, it, expect } from "vitest";
import { isOutOfDateWithCDS, hasUnpublishedChanges } from "../cdsState";

describe("cdsState", () => {
  describe("isOutOfDateWithCDS", () => {
    it("returns false when stored version is null/undefined", () => {
      expect(
        isOutOfDateWithCDS({ version: 10, publishedVersion: 9 }, null)
      ).toBe(false);
      expect(
        isOutOfDateWithCDS({ version: 10, publishedVersion: 9 }, undefined)
      ).toBe(false);
    });

    it("returns false when publishedVersion is null", () => {
      expect(isOutOfDateWithCDS({ publishedVersion: null }, 5)).toBe(false);
    });

    it("returns false when publishedVersion is within +2 of stored version", () => {
      // writeNprCDSData does update+publish, bumping publishedVersion by 2
      expect(isOutOfDateWithCDS({ publishedVersion: 7 }, 5)).toBe(false);
      expect(isOutOfDateWithCDS({ publishedVersion: 6 }, 5)).toBe(false);
      expect(isOutOfDateWithCDS({ publishedVersion: 5 }, 5)).toBe(false);
    });

    it("returns true when publishedVersion exceeds stored version + 2", () => {
      expect(isOutOfDateWithCDS({ publishedVersion: 8 }, 5)).toBe(true);
      expect(isOutOfDateWithCDS({ publishedVersion: 100 }, 5)).toBe(true);
    });
  });

  describe("hasUnpublishedChanges", () => {
    it("returns false when version or publishedVersion is missing", () => {
      expect(
        hasUnpublishedChanges({ version: 5, publishedVersion: null })
      ).toBe(false);
      expect(hasUnpublishedChanges({ publishedVersion: 4 })).toBe(false);
    });

    it("draws the boundary at version > publishedVersion + 1", () => {
      // Contentful bumps version by 1 on publish, so a clean entry has
      // version === publishedVersion + 1; anything higher means a draft.
      expect(hasUnpublishedChanges({ version: 5, publishedVersion: 4 })).toBe(
        false
      );
      expect(hasUnpublishedChanges({ version: 6, publishedVersion: 4 })).toBe(
        true
      );
    });
  });
});
