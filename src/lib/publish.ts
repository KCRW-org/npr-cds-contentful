import { markdownToTxt } from "markdown-to-txt";
import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import type { Options } from "@contentful/rich-text-html-renderer";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";
import type {
  Document,
  Block,
  Inline,
  Text,
  TopLevelBlock,
} from "@contentful/rich-text-types";
import type {
  CdsStoryDocumentInput,
  Reference,
  ResolvedEmbedEntry,
  ResolvedImage,
} from "../types";

const NPR_CDS_BASE = "https://content.api.npr.org";
export const NPR_ONE_LOCAL_COLLECTION_ID = "319418027";
export const NPR_ONE_FEATURED_COLLECTION_ID = "500549367";

export const markdownToPlainText = (markdown: string): string => {
  if (!markdown) return "";
  return markdownToTxt(markdown).replace(/\s+/g, " ").trim();
};

export type { ResolvedEmbedEntry };

// ---------------------------------------------------------------------------
// Private HTML serialization helpers
// ---------------------------------------------------------------------------

const RENDER_OPTIONS: Options = {
  renderNode: {
    [BLOCKS.EMBEDDED_ENTRY]: () => "",
    [BLOCKS.EMBEDDED_ASSET]: () => "",
    [INLINES.ASSET_HYPERLINK]: () => "",
    [INLINES.ENTRY_HYPERLINK]: () => "",
    [INLINES.EMBEDDED_ENTRY]: () => "",
  },
};

const nodeToHtml = (node: TopLevelBlock): string =>
  documentToHtmlString(
    { nodeType: BLOCKS.DOCUMENT, data: {}, content: [node] },
    RENDER_OPTIONS
  );

// Extract plain text from inline nodes (used for external-link titles)
const extractText = (nodes: Array<Block | Inline | Text>): string =>
  nodes
    .map(n => {
      if (n.nodeType === "text") return (n as Text).value;
      if ("content" in n) return extractText((n as Block | Inline).content);
      return "";
    })
    .join("");

// ---------------------------------------------------------------------------
// Asset builders for layout entries
// ---------------------------------------------------------------------------

const buildTextAsset = (id: string, html: string): unknown => ({
  id,
  profiles: [
    { href: "/v1/profiles/text", rels: ["type"] },
    { href: "/v1/profiles/document" },
  ],
  text: html,
});

const buildImageAsset = (
  id: string,
  embed: ResolvedImage
): unknown | undefined => {
  if (!embed.width || !embed.height) return undefined;

  const {
    url,
    altText,
    width,
    height,
    focusHint,
    caption,
    producer,
    provider,
  } = embed;
  const enclosures: unknown[] = [];
  const hrefTemplate = `${url}?w={width}&q={quality}&fm={format}`;

  if (width && height) {
    const ratio = width / height;
    const isSquare = width === height;
    const isNoCrop = focusHint === "nocrop";

    let aspectRel: string;
    if (isSquare) {
      aspectRel = "image-square";
    } else if (ratio >= 1.7 && ratio <= 1.8) {
      aspectRel = "image-wide";
    } else if (ratio < 1) {
      aspectRel = "image-vertical";
    } else {
      aspectRel = "image-standard";
    }

    enclosures.push({
      href: url + "?fm=jpg&q=80",
      width,
      height,
      type: "image/jpeg",
      hrefTemplate,
      rels: ["primary", "scalable", aspectRel],
    });

    if (aspectRel !== "image-square") {
      let squareHref = `${url}?w=600&h=600&fm=jpg&q=80`;
      let squareHrefTemplate = `${hrefTemplate}&h={width}`;
      if (isNoCrop) {
        squareHref += `&fit=pad`;
        squareHrefTemplate += `&fit=pad`;
      } else if (focusHint) {
        squareHref += `&f=${focusHint}&fit=fill`;
        squareHrefTemplate += `&f=${focusHint}&fit=fill`;
      }
      enclosures.push({
        href: squareHref,
        hrefTemplate: squareHrefTemplate,
        type: "image/jpeg",
        width: 600,
        height: 600,
        rels: ["image-square", "scalable"],
      });
    }
    if (aspectRel !== "image-wide") {
      let wideHref = `${url}?w=1200&h=676&fm=jpg&q=80`;
      if (isNoCrop) {
        wideHref += `&fit=pad`;
      } else if (focusHint) {
        wideHref += `&f=${focusHint}&fit=fill`;
      }
      enclosures.push({
        href: wideHref,
        type: "image/jpeg",
        width: 1200,
        height: 676,
        rels: ["image-wide"],
      });
    }
  }

  return {
    id,
    profiles: [
      { href: "/v1/profiles/image", rels: ["type"] },
      { href: "/v1/profiles/document" },
    ],
    enclosures,
    ...(altText ? { altText } : {}),
    ...(caption ? { caption } : {}),
    ...(producer ? { producer } : {}),
    ...(provider ? { provider } : {}),
  };
};

const buildAudioLayoutAsset = (
  id: string,
  embed: { url: string; duration?: number }
): unknown => ({
  id,
  profiles: [
    { href: "/v1/profiles/audio", rels: ["type"] },
    { href: "/v1/profiles/document" },
  ],
  enclosures: [{ href: embed.url, type: "audio/mpeg" }],
  isAvailable: true,
  isStreamable: false,
  isDownloadable: false,
  isEmbeddable: false,
  ...(embed.duration ? { duration: embed.duration } : {}),
});

const buildYoutubeAsset = (id: string, videoId: string): unknown => ({
  id,
  profiles: [
    { href: "/v1/profiles/youtube-video", rels: ["type"] },
    { href: "/v1/profiles/document" },
  ],
  externalId: videoId,
});

// ---------------------------------------------------------------------------
// Layout builder
// ---------------------------------------------------------------------------

export const buildLayoutFromRichText = (
  doc: Document,
  resolvedEmbeds: Map<string, ResolvedEmbedEntry>
): { refs: Reference[]; layoutAssets: Record<string, unknown> } => {
  const refs: Reference[] = [];
  const layoutAssets: Record<string, unknown> = {};

  let textCount = 0;
  let linkCount = 0;
  let imageCount = 0;
  let audioCount = 0;
  let videoCount = 0;
  let htmlCount = 0;

  for (const node of doc.content) {
    switch (node.nodeType) {
      case BLOCKS.HR:
        // skip
        break;

      case BLOCKS.PARAGRAPH: {
        // A paragraph whose sole non-empty child is a hyperlink → external-link asset
        const nonEmpty = (node as Block).content.filter(
          c => !(c.nodeType === "text" && (c as Text).value === "")
        );
        const linkNode =
          nonEmpty.length === 1 && nonEmpty[0].nodeType === INLINES.HYPERLINK
            ? (nonEmpty[0] as Inline)
            : null;
        const href = linkNode
          ? (linkNode.data as Record<string, string>)?.uri
          : "";
        if (linkNode && href) {
          const linkText = extractText(
            linkNode.content as Array<Block | Inline | Text>
          );
          const id = `layout-link-${linkCount++}`;
          layoutAssets[id] = {
            id,
            profiles: [
              { href: "/v1/profiles/external-link", rels: ["type"] },
              { href: "/v1/profiles/document" },
            ],
            externalLink: href,
            ...(linkText ? { title: linkText } : {}),
          };
          refs.push({ href: `#/assets/${id}` });
        } else {
          const html = nodeToHtml(node);
          if (html && html !== "<p></p>") {
            const id = `layout-text-${textCount++}`;
            layoutAssets[id] = buildTextAsset(id, html);
            refs.push({ href: `#/assets/${id}` });
          }
        }
        break;
      }

      case BLOCKS.HEADING_1:
      case BLOCKS.HEADING_2:
      case BLOCKS.HEADING_3:
      case BLOCKS.HEADING_4:
      case BLOCKS.HEADING_5:
      case BLOCKS.HEADING_6:
      case BLOCKS.UL_LIST:
      case BLOCKS.OL_LIST:
      case BLOCKS.QUOTE:
      case BLOCKS.TABLE: {
        const html = nodeToHtml(node);
        if (html) {
          const id = `layout-text-${textCount++}`;
          layoutAssets[id] = buildTextAsset(id, html);
          refs.push({ href: `#/assets/${id}` });
        }
        break;
      }

      case BLOCKS.EMBEDDED_ENTRY: {
        const entryId: string = (node as Block).data?.target?.sys?.id;
        if (!entryId) break;
        const embed = resolvedEmbeds.get(entryId);
        if (!embed || embed.type === "unknown") break;

        if (embed.type === "image") {
          const id = `layout-image-${imageCount++}`;
          const asset = buildImageAsset(id, embed);
          if (asset) {
            layoutAssets[id] = asset;
            refs.push({ href: `#/assets/${id}` });
          }
        } else if (embed.type === "audio") {
          const id = `layout-audio-${audioCount++}`;
          layoutAssets[id] = buildAudioLayoutAsset(id, embed);
          refs.push({ href: `#/assets/${id}` });
        } else if (embed.type === "youtube") {
          const id = `layout-video-${videoCount++}`;
          layoutAssets[id] = buildYoutubeAsset(id, embed.videoId);
          refs.push({ href: `#/assets/${id}` });
        } else if (embed.type === "html") {
          const id = `layout-html-${htmlCount++}`;
          layoutAssets[id] = {
            id,
            profiles: [
              { href: "/v1/profiles/html-block", rels: ["type"] },
              { href: "/v1/profiles/document" },
            ],
            html: embed.html,
          };
          refs.push({ href: `#/assets/${id}` });
        }
        break;
      }

      case BLOCKS.EMBEDDED_ASSET: {
        const assetId: string = (node as Block).data?.target?.sys?.id;
        if (!assetId) break;
        const embed = resolvedEmbeds.get(assetId);
        if (!embed || embed.type !== "image") break;

        const id = `layout-image-${imageCount++}`;
        const asset = buildImageAsset(id, embed);
        if (asset) {
          layoutAssets[id] = asset;
          refs.push({ href: `#/assets/${id}` });
        }
        break;
      }
    }
  }

  return { refs, layoutAssets };
};

// ---------------------------------------------------------------------------
// buildCdsDocument
// ---------------------------------------------------------------------------

type BuildCdsDocumentParams = {
  entryId: string;
  title: string;
  teaser?: string;
  publishDateTime?: string;
  canonicalUrl?: string;
  image?: ResolvedImage;
  audio?: {
    url: string;
    duration?: number;
    embedUrl?: string;
    rels?: string[];
  };
  bylines?: string[];
  nprServiceId?: string;
  collectionIds?: string[];
  layout?: { refs: Reference[]; layoutAssets: Record<string, unknown> };
  additionalWebPages?: Array<{ href: string; rels: string[] }>;
  additionalCollections?: Array<{ href: string; rels: string[] }>;
  documentProperties?: Record<string, unknown>;
  recommendUntilDays?: number;
  cdsDocumentPrefix?: string;
};

export const buildCdsDocument = (
  params: BuildCdsDocumentParams
): CdsStoryDocumentInput => {
  const {
    entryId,
    title,
    teaser,
    publishDateTime,
    canonicalUrl,
    image,
    audio,
    bylines = [],
    nprServiceId,
    collectionIds = [NPR_ONE_LOCAL_COLLECTION_ID],
    layout,
    additionalWebPages = [],
    additionalCollections = [],
    documentProperties = {},
    recommendUntilDays = 7,
    cdsDocumentPrefix = "contentful-cds",
  } = params;

  const safeEntryId = entryId.toLowerCase();
  const documentId = `${cdsDocumentPrefix}-${safeEntryId}`;

  const recommendUntilDateTime = publishDateTime
    ? new Date(
        new Date(publishDateTime).getTime() +
          recommendUntilDays * 24 * 60 * 60 * 1000
      ).toISOString()
    : undefined;

  const profiles: CdsStoryDocumentInput["profiles"] = [
    { href: "/v1/profiles/document" },
    { href: "/v1/profiles/story", rels: ["type"] },
    { href: "/v1/profiles/publishable", rels: ["interface"] },
    { href: "/v1/profiles/renderable", rels: ["interface"] },
  ];

  if (layout && layout.refs.length > 0) {
    profiles.push({ href: "/v1/profiles/buildout", rels: ["interface"] });
  }

  const imgAssetId = `img-${safeEntryId}`;
  const primaryImageAsset = image?.url
    ? buildImageAsset(imgAssetId, image)
    : undefined;

  if (primaryImageAsset) {
    profiles.push({ href: "/v1/profiles/has-images", rels: ["interface"] });
  }
  if (audio?.url) {
    profiles.push({ href: "/v1/profiles/has-audio", rels: ["interface"] });
    profiles.push({ href: "/v1/profiles/listenable", rels: ["interface"] });
  }

  const assets: Record<string, unknown> = {};

  if (primaryImageAsset) {
    assets[imgAssetId] = primaryImageAsset;
  }

  if (audio?.url) {
    const audioAssetId = `audio-${safeEntryId}`;
    assets[audioAssetId] = {
      id: audioAssetId,
      profiles: [
        { href: "/v1/profiles/audio", rels: ["type"] },
        { href: "/v1/profiles/document" },
      ],
      enclosures: [
        { href: audio.url, type: "audio/mpeg", rels: audio.rels || [] },
      ],
      isAvailable: true,
      isStreamable: false,
      isDownloadable: false,
      isEmbeddable: audio.embedUrl ? true : false,
      embeddedPlayerLink: audio.embedUrl ? { href: audio.embedUrl } : undefined,
      ...(audio.duration ? { duration: audio.duration } : {}),
    };
  }

  bylines.forEach((name, index) => {
    const bylineAssetId = `byline-${index}`;
    assets[bylineAssetId] = {
      id: bylineAssetId,
      profiles: [
        { href: "/v1/profiles/byline", rels: ["type"] },
        { href: "/v1/profiles/document" },
      ],
      name,
    };
  });

  // Merge layout assets before building the doc object
  if (layout) {
    Object.assign(assets, layout.layoutAssets);
  }

  const doc: CdsStoryDocumentInput = {
    ...documentProperties,
    id: documentId,
    title,
    profiles,
    collections: [
      ...collectionIds.map(id => ({
        href: `/v1/documents/${id}`,
        rels: ["collection"],
      })),
      ...additionalCollections,
    ],
    owners: nprServiceId
      ? [
          {
            href: `https://organization.api.npr.org/v4/services/${nprServiceId}`,
          },
        ]
      : [],
    brandings: nprServiceId
      ? [
          {
            href: `https://organization.api.npr.org/v4/services/${nprServiceId}`,
          },
        ]
      : [],
    authorizedOrgServiceIds: nprServiceId ? [nprServiceId] : [],
    assets,
  };

  if (teaser) doc.teaser = teaser;
  if (publishDateTime) doc.publishDateTime = publishDateTime;
  if (recommendUntilDateTime)
    doc.recommendUntilDateTime = recommendUntilDateTime;

  const webPages: CdsStoryDocumentInput["webPages"] = [];
  if (canonicalUrl) webPages.push({ href: canonicalUrl, rels: ["canonical"] });
  for (const page of additionalWebPages) webPages.push(page);
  if (webPages.length > 0) doc.webPages = webPages;

  if (primaryImageAsset) {
    doc.images = [{ href: `#/assets/${imgAssetId}`, rels: ["primary"] }];
  }

  if (audio?.url) {
    doc.audio = [
      { href: `#/assets/audio-${safeEntryId}`, rels: ["headline", "primary"] },
    ];
  }

  if (bylines.length > 0) {
    doc.bylines = bylines.map((_, index) => ({
      href: `#/assets/byline-${index}`,
    }));
  }

  const layoutRefs: Reference[] = [];
  // Add the image at the start if we have any other content
  if (layout && layout.refs.length > 0 && primaryImageAsset) {
    layoutRefs.push({ href: `#/assets/${imgAssetId}` });
  }
  if (layout) {
    layoutRefs.push(...layout.refs);
  }
  doc.layout = layoutRefs;

  return doc;
};

export const publishStoryToCds = async (
  document: CdsStoryDocumentInput,
  token: string,
  baseUrl = NPR_CDS_BASE
): Promise<{ ok: boolean; status: number; body: unknown }> => {
  const url = `${baseUrl}/v1/documents/${document.id}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(document),
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
};

export const checkCdsPublishStatus = async (
  entryId: string,
  token: string,
  baseUrl = NPR_CDS_BASE,
  prefix = "contentful-cds"
): Promise<boolean> => {
  const documentId = `${prefix}-${entryId.toLowerCase()}`;
  const url = `${baseUrl}/v1/documents/${documentId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok;
};
