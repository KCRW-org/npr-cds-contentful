import {
  Audio,
  Collection,
  CollectionQueryResponse,
  Image,
  Story,
  StoryLookupResponse,
} from "../types";

const NPR_CDS_BASE = "https://content.api.npr.org";
const IMAGE_PREFERENCE = ["primary", "promo-image-brick", "thumbnail"];
const SCALE_PREFERENCES = ["scalable", "image-brick", "image-wide", "primary"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AUDIO_PREFERENCES = ["primary", "nprone-override", "headline"];
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/aac",
  "audio/aacp",
  "audio/mp4",
  "audio/ogg",
];

export const idFromURN = (urn: string) => {
  return urn.split("/").pop();
};

export const fetchByURN = async (urn: string, token: string) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const apiUrl = NPR_CDS_BASE + urn;
  const response = await fetch(apiUrl, {
    headers,
  });
  const responseValue = await response.json();
  return responseValue.resources;
};

const preferredImageForItem = (
  item: Story | Collection
): StoryLookupResponse["image"] => {
  if (!item.images || !item.assets) {
    return;
  }
  let foundEnclosure;
  let resultImage;
  for (const image of item.images) {
    if (!image.rels) {
      continue;
    }
    const imageId = idFromURN(image.href);
    if (!imageId) {
      continue;
    }
    const imageAsset = item.assets[imageId] as Image;
    resultImage = {
      altText: imageAsset.altText || imageAsset.title,
      url: "",
      scalable: false,
    } as StoryLookupResponse["image"];
    for (const prefScale of IMAGE_PREFERENCE) {
      if (!image.rels.includes(prefScale)) {
        continue;
      }
      for (const scale of SCALE_PREFERENCES) {
        for (const enclosure of imageAsset.enclosures) {
          if (!enclosure.rels || !enclosure.type) {
            continue;
          }
          if (
            enclosure.rels.includes(scale) &&
            ALLOWED_IMAGE_TYPES.includes(enclosure.type)
          ) {
            foundEnclosure = enclosure;
            break;
          }
        }
      }
      if (foundEnclosure) {
        break;
      }
    }
    if (foundEnclosure && resultImage) {
      resultImage.url = foundEnclosure.href;
      if (
        foundEnclosure.rels &&
        foundEnclosure.rels.includes("scalable") &&
        foundEnclosure.hrefTemplate
      ) {
        resultImage.scalable = true;
        resultImage.urlTemplate = foundEnclosure.hrefTemplate;
      }
      return resultImage;
    }
  }
};

const preferredAudioForStory = (story: Story): StoryLookupResponse["audio"] => {
  if (!story.audio || !story.assets) {
    return;
  }
  for (const audio of story.audio) {
    if (!audio.rels) {
      continue;
    }
    const audioId = idFromURN(audio.href);
    if (!audioId) {
      continue;
    }
    const audioAsset = story.assets[audioId] as Audio;
    if (
      !(
        audioAsset.isAvailable &&
        (audioAsset.isStreamable ||
          audioAsset.isEmbeddable ||
          audioAsset.isDownloadable)
      )
    ) {
      continue;
    }
    const resultAudio = { url: "", duration: audioAsset.duration };
    for (const prefAudio of AUDIO_PREFERENCES) {
      if (!audio.rels.includes(prefAudio)) {
        continue;
      }
      let foundEnclosure;
      for (const enclosure of audioAsset.enclosures) {
        if (enclosure.type && ALLOWED_AUDIO_TYPES.includes(enclosure.type)) {
          foundEnclosure = enclosure;
          break;
        }
      }
      if (foundEnclosure) {
        resultAudio.url = foundEnclosure.href;
        return resultAudio;
      }
    }
  }
};

const canonicalLink = (item: Story | Collection): string | undefined => {
  if (!item.webPages) {
    return;
  }
  for (const link of item.webPages) {
    if (link.rels && link.rels.includes("canonical")) {
      return link.href;
    }
  }
};

export const queryCDS = async (
  query: URLSearchParams,
  token: string,
  requireImages: boolean = false
) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  let queryString = query.toString();
  if (requireImages) {
    queryString += "&profileIds=has-images";
  }
  const apiUrl = NPR_CDS_BASE + "/v1/documents?" + queryString;
  const response = await fetch(apiUrl, {
    headers,
  });
  const responseValue = await response.json();
  return responseValue.resources;
};

export const storyLookupForStory = (story: Story): StoryLookupResponse => {
  const urn = `/v1/documents/${story.id}`;
  return {
    urn,
    id: story.id,
    title: story.title,
    subtitle: story.subtitle || story.shortTeaser,
    description: story.teaser,
    publishDateTime: story.publishDateTime,
    externalUrl: canonicalLink(story),
    image: preferredImageForItem(story),
    audio: preferredAudioForStory(story),
  } as StoryLookupResponse;
};

export const collectionLookupForCollection = (
  collection: Collection
): CollectionQueryResponse => {
  const urn = `/v1/documents/${collection.id}`;
  const collectionLookup = {
    urn,
    id: collection.id,
  } as CollectionQueryResponse;
  if (
    collection.profiles?.find(
      profile => profile.href === "/v1/profiles/publishable"
    )
  ) {
    collectionLookup.title = collection.title;
    collectionLookup.subtitle = collection.subtitle || collection.shortTeaser;
    collectionLookup.description = collection.teaser;
    collectionLookup.publishDateTime = collection.publishDateTime;
    collectionLookup.externalUrl = canonicalLink(collection);
    collectionLookup.image = preferredImageForItem(collection);
  } else {
    collectionLookup.title = `NPR Collection ${collection.id}`;
  }
  return collectionLookup;
};

export const cleanupLookupItem = (
  item: StoryLookupResponse | CollectionQueryResponse
) => {
  // Cleanup objects for lookups
  if (!item.image || !item.image.url) {
    item.image = { url: "", altText: "" };
  }
  if (!item.subtitle) {
    item.subtitle = item.description || "";
  }
  return item;
};
