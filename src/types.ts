export type AppInstallationParameters = {
  cdsAccessToken?: string;
  cdaToken?: string;
  nprServiceId?: string;
  cdsEnvironment?: "production" | "staging";
  cdsDocumentPrefix?: string;
  canonicalUrlTemplate?: string;
  audioEmbedUrlTemplate?: string;
  locale?: string;
  recommendUntilDays?: number;
  enableLayout?: boolean;
  /**
   * CDA include depth used when fetching the story entry. Must cover the
   * deepest link chain your schema follows from the story (e.g. body embed →
   * photo → asset = depth 3). Clamped to [1, 10] by the CDA. Defaults to 3.
   */
  cdaIncludeDepth?: number;
};

export type ResolvedImage = {
  url: string;
  altText?: string;
  width?: number;
  height?: number;
  focusHint?: string;
  caption?: string;
  producer?: string;
  provider?: string;
};

export type ResolvedEmbedEntry =
  | ({ type: "image" } & ResolvedImage)
  | { type: "audio"; url: string; duration?: number }
  | { type: "youtube"; videoId: string }
  | { type: "html"; html: string }
  | { type: "unknown" };

export type PublishActionBody = {
  entryId: string;
  submitToNprOneLocal?: boolean;
  submitToNprOneFeatured?: boolean;
  environmentAlias?: string;
};

export type PublishActionResult = {
  success: boolean;
  documentId?: string;
  documentUrl?: string;
  error?: string;
};

export type DeleteActionBody = {
  action: "delete";
  entryId: string;
};

export type DeleteActionResult = {
  success: boolean;
  error?: string;
};

export type CdsStoryDocumentInput = {
  id: string;
  title: string;
  teaser?: string;
  publishDateTime?: string;
  recommendUntilDateTime?: string;
  nprDisplayType?: string;
  profiles: Array<{ href: string; rels?: string[] }>;
  collections: Array<{ href: string; rels: string[] }>;
  owners: Array<{ href: string }>;
  brandings: Array<{ href: string }>;
  authorizedOrgServiceIds?: string[];
  webPages?: Array<{ href: string; rels: string[] }>;
  images?: Array<{ href: string; rels: string[] }>;
  audio?: Array<{ href: string; rels: string[] }>;
  bylines?: Array<{ href: string }>;
  layout?: Reference[];
  assets: Record<string, unknown>;
};

export type Reference = {
  href: string;
  rels?: string[];
};

export type ResourceLookupResponse = {
  nprId: string;
  sys: { id: string };
  urn: string;
  title?: string;
  subtitle?: string;
  description?: string;
  publishDateTime?: string;
  externalUrl?: string;
  image?: {
    url: string | null;
    altText?: string | null;
    scalable?: boolean;
    urlTemplate?: string;
  };
};

export type StoryLookupResponse = ResourceLookupResponse & {
  audio?: { url: string | null; duration?: number | null };
};

export type CollectionQueryResponse = ResourceLookupResponse & {
  items?: StoryLookupResponse[];
};

export type Asset = {
  id: string;
  profiles: Reference[];
};

export type Byline = Asset & {
  name: string;
};

export type Correction = Asset & {
  text: string;
  dateTime: string;
};

export type Enclosure = Reference & {
  hrefTemplate?: string;
  type?: string;
  width?: number;
  height?: number;
  isStreamable?: boolean;
  isAvailable?: boolean;
};

export type Image = Asset & {
  enclosures: Enclosure[];
  title?: string;
  producer?: string;
  provider?: string;
  providerLink?: Reference;
  altText?: string;
  caption?: string;
  enlargementCaption?: string;
  displaySize?: string;
};

export type Audio = Asset & {
  enclosures: Enclosure[];
  isAvailable: boolean;
  isDownloadable: boolean;
  isEmbeddable?: boolean;
  isStreamable: boolean;
  source?: string;
  sourceHash?: string;
  duration?: number;
  availabilityMessage?: string;
  songTitle?: string;
  songArtist?: string;
  albumTitle?: string;
  albumArtist?: string;
  streamExpirationDateTime?: string;
  transcriptLink?: Reference;
  transcriptWebPageLink?: Reference;
  embeddedPlayerLink?: Reference;
};

export type Publishable = Asset & {
  title?: string;
  subtitle?: string;
  socialTitle?: string;
  teaser?: string;
  shortTeaser?: string;
  publishDateTime?: string;
  webPages?: Reference[];
  contributionNotes?: string;
  assets?: Record<string, Audio | Image | Byline | Correction | Asset>;
};

export type Imageable = Publishable & {
  images?: Reference[];
};

export type Story = Imageable & {
  title: string;
  subtitle?: string;
  socialTitle?: string;
  teaser?: string;
  shortTeaser?: string;
  publishDateTime?: string;
  webPages?: Reference[];
  contributionNotes?: string;
  brandings: (Reference | null)[];
  owners: (Reference | null)[];
  audio?: Reference[];
  bylines?: Reference[];
  corrections?: Reference[];
  relatedItems?: Reference[];
  editorialMajorUpdateDateTime?: string;
};

export type Collection = Imageable & {
  items: Reference[];
};
