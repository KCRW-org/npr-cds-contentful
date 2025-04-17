export type AppInstallationParameters = {
  cdsAccessToken?: string;
};

export type Reference = {
  href: string;
  rels?: string[];
};

export type ResourceLookupResponse = {
  id: string;
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
