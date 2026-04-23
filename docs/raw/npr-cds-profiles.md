# NPR CDS Profiles Reference

> Source: https://npr.github.io/content-distribution-service/api-reference/profiles/
> Raw schemas: https://content.api.npr.org/v1/profiles/<name>
> Last fetched: 2026-04-23

NPR CDS documents are validated against JSON Schema "profiles". A document's
`profiles` array lists the profiles it implements; each profile contributes a
set of properties and/or constraints. Profiles compose via `allOf` — for
example, `story` extends `publishable` which extends `document`.

The tables below are generated from the raw schema at `https://content.api.npr.org/v1/profiles/<name>`.
Descriptions are truncated to 240 chars; consult the raw schema for full text,
pattern constraints, `$defs`, and nested link structures.

## Profile Index

- [`aggregation`](#aggregation--aggregation)
- [`area`](#area--area)
- [`audio`](#audio--audio)
- [`audio-card`](#audio-card--audio-card)
- [`biography`](#biography--biography)
- [`blog`](#blog--blog)
- [`blog-category`](#blog-category--blog-category)
- [`book-ecommerce`](#book-ecommerce--book-e-commerce)
- [`buildout`](#buildout--buildout)
- [`byline`](#byline--byline)
- [`card`](#card--card)
- [`collection`](#collection--collection)
- [`container`](#container--container)
- [`correction`](#correction--correction)
- [`document`](#document--core-document)
- [`external-link`](#external-link--external-link)
- [`has-audio`](#has-audio--has-audio)
- [`has-corrections`](#has-corrections--has-corrections)
- [`has-galleries`](#has-galleries--has-galleries)
- [`has-html-blocks`](#has-html-blocks--has-html-blocks)
- [`has-images`](#has-images--has-images)
- [`has-notes`](#has-notes--has-notes)
- [`has-premium-audio`](#has-premium-audio--has-premium-audio)
- [`has-social-handles`](#has-social-handles--has-social-handles)
- [`has-videos`](#has-videos--has-videos)
- [`homepage`](#homepage--homepage)
- [`html-block`](#html-block--html-block)
- [`html-card`](#html-card--html-card)
- [`image`](#image--image)
- [`image-gallery`](#image-gallery--image-gallery)
- [`inset`](#inset--inset)
- [`internal-link`](#internal-link--internal-link)
- [`list`](#list--list)
- [`listenable`](#listenable--listenable)
- [`music-artist`](#music-artist--music-artist)
- [`music-genre`](#music-genre--music-genre)
- [`newscast`](#newscast--newscast)
- [`note`](#note--note)
- [`player-video`](#player-video--player-video)
- [`podcast-category`](#podcast-category--podcast-category)
- [`podcast-channel`](#podcast-channel--podcast-channel)
- [`podcast-episode`](#podcast-episode--podcast-episode)
- [`program`](#program--program)
- [`program-episode`](#program-episode--program-episode)
- [`promo-card`](#promo-card--promo-card)
- [`publishable`](#publishable--publishable)
- [`pull-quote`](#pull-quote--pull-quote)
- [`reference-byline`](#reference-byline--reference-byline)
- [`renderable`](#renderable--renderable)
- [`resource-container`](#resource-container--resource-container)
- [`series`](#series--series)
- [`social-handle`](#social-handle--social-handle)
- [`story`](#story--story)
- [`stream-player-video`](#stream-player-video--stream-player-video)
- [`tag`](#tag--tag)
- [`text`](#text--text)
- [`topic`](#topic--topic)
- [`transcript`](#transcript--transcript)
- [`tweet`](#tweet--tweet)
- [`video-carousel-card`](#video-carousel-card--video-carousel-card)
- [`youtube-video`](#youtube-video--youtube-video)

---

### `aggregation` — Aggregation

> Schema: [`/v1/profiles/aggregation`](https://content.api.npr.org/v1/profiles/aggregation) · Docs: [aggregation](https://npr.github.io/content-distribution-service/api-reference/profiles/aggregation.html)

An object that can have an ordered list of links to documents

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `items` | array<internal-document-link & no-rels-link> | ✓ | A prioritized list of links to documents that make up this aggregation |
| `relatedNewsletterIds` | array<enum(29 values)> |  | Indicate which newsletter(s), if any, with which this aggregation is associated. The string can be used with other APIs that handle NPR newsletters. |

---

### `area` — Area

> Schema: [`/v1/profiles/area`](https://content.api.npr.org/v1/profiles/area) · Docs: [area](https://npr.github.io/content-distribution-service/api-reference/profiles/area.html)

An area within another document that contains sequential document assets for layout purposes

**Extends:** `document-with-container-profile`

---

### `audio` — Audio

> Schema: [`/v1/profiles/audio`](https://content.api.npr.org/v1/profiles/audio) · Docs: [audio](https://npr.github.io/content-distribution-service/api-reference/profiles/audio.html)

An audio asset

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | string |  | The title of this audio asset |
| `source` | string |  | An identifier (e.g., GUID, filename, or URL) to use to direct one back to the audio source. |
| `sourceHash` | string |  | The unique file hash associated with the source audio file. |
| `enclosures` | array<audio-file-link> | ✓ | The links to the various instances of this audio |
| `duration` | integer |  | The known accepted duration of this audio asset in seconds |
| `isAvailable` | boolean | ✓ | Is this audio available and ready for access |
| `isDownloadable` | boolean | ✓ | Is this audio available for download |
| `isEmbeddable` | boolean | ✓ | Is this audio available for embed |
| `isStreamable` | boolean | ✓ | Is this audio available for stream |
| `availabilityMessage` | string |  | Description associated with the availability |
| `songTitle` | string |  | title for song audio |
| `songArtist` | string |  | artist for song audio |
| `songTrackNumber` | string |  | track number for song audio |
| `albumTitle` | string |  | album title for music audio |
| `albumArtist` | string |  | album artist for music audio |
| `streamExpirationDateTime` | string(date-time) |  | The date and time that this stream expires, in RFC3339 full-date-time format |
| `transcriptLink` | internal-document-link & object |  | A link to the document representing the transcript of this audio |
| `transcriptWebPageLink` | external-link & no-rels-link |  | A link to the web page where the transcript of this audio is displayed |
| `embeddedPlayerLink` | external-link & no-rels-link |  | A link to an embedded audio player serving this audio |

---

### `audio-card` — Audio Card

> Schema: [`/v1/profiles/audio-card`](https://content.api.npr.org/v1/profiles/audio-card) · Docs: [audio-card](https://npr.github.io/content-distribution-service/api-reference/profiles/audio-card.html)

A card document which features audio for display

_No properties defined — see raw schema._

---

### `biography` — Biography

> Schema: [`/v1/profiles/biography`](https://content.api.npr.org/v1/profiles/biography) · Docs: [biography](https://npr.github.io/content-distribution-service/api-reference/profiles/biography.html)

A biography document which aggregates other documents under a particular author

_No properties defined — see raw schema._

---

### `blog` — Blog

> Schema: [`/v1/profiles/blog`](https://content.api.npr.org/v1/profiles/blog) · Docs: [blog](https://npr.github.io/content-distribution-service/api-reference/profiles/blog.html)

A blog document which aggregates blog content.

_No properties defined — see raw schema._

---

### `blog-category` — Blog Category

> Schema: [`/v1/profiles/blog-category`](https://content.api.npr.org/v1/profiles/blog-category) · Docs: [blog-category](https://npr.github.io/content-distribution-service/api-reference/profiles/blog-category.html)

A blog category document which aggregates related blogs.

_No properties defined — see raw schema._

---

### `book-ecommerce` — Book E-Commerce

> Schema: [`/v1/profiles/book-ecommerce`](https://content.api.npr.org/v1/profiles/book-ecommerce) · Docs: [book-ecommerce](https://npr.github.io/content-distribution-service/api-reference/profiles/book-ecommerce.html)

A description of a book, and a list of affiliate links which can be embedded in a page

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | string | ✓ | The plain-text title of the book being sold. |
| `subtitle` | string |  | A continuation of the title, also plain text, if the title is long or has a natural break |
| `author` | string | ✓ | The name(s) of the author(s) of the book in plain text. This format is determinded by editorial, and is not controlled by CDS |
| `affiliates` | array<link & object> | ✓ | A list of vendors and their websites where the book can be obtained. |

---

### `buildout` — Buildout

> Schema: [`/v1/profiles/buildout`](https://content.api.npr.org/v1/profiles/buildout) · Docs: [buildout](https://npr.github.io/content-distribution-service/api-reference/profiles/buildout.html)

A document that should have a non-empty layout property, or one that implements one or more 'built out' profiles

_No properties defined — see raw schema._

---

### `byline` — Byline

> Schema: [`/v1/profiles/byline`](https://content.api.npr.org/v1/profiles/byline) · Docs: [byline](https://npr.github.io/content-distribution-service/api-reference/profiles/byline.html)

A byline representing a person or other entity responsible for the creation of this document. The person or entity represented by this asset should hold attributable responsibility for a portion of the content represented in this document.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | ✓ |  |

---

### `card` — Card

> Schema: [`/v1/profiles/card`](https://content.api.npr.org/v1/profiles/card) · Docs: [card](https://npr.github.io/content-distribution-service/api-reference/profiles/card.html)

Free-form callout content item. Intended to be used as a 'type'.

**Extends:** `card`, `sizable-asset`

---

### `collection` — Collection

> Schema: [`/v1/profiles/collection`](https://content.api.npr.org/v1/profiles/collection) · Docs: [collection](https://npr.github.io/content-distribution-service/api-reference/profiles/collection.html)

A collection document which aggregates other documents into a generic grouping.

_No properties defined — see raw schema._

---

### `container` — Container

> Schema: [`/v1/profiles/container`](https://content.api.npr.org/v1/profiles/container) · Docs: [container](https://npr.github.io/content-distribution-service/api-reference/profiles/container.html)

A document that has inner content. Intended to be used as an 'interface'.

**Extends:** `has-layout`

---

### `correction` — Correction

> Schema: [`/v1/profiles/correction`](https://content.api.npr.org/v1/profiles/correction) · Docs: [correction](https://npr.github.io/content-distribution-service/api-reference/profiles/correction.html)

A correction asset for this document. This asset should represent a corrective change made to this document at a particular point in time after it was originally published.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | string |  | The title of this correction to be displayed along with the text |
| `text` | string | ✓ | The textual description of the correction that was made to this document (with optional formatting or markup). |
| `dateTime` | string(date-time) | ✓ | The date and time this correction was made |

---

### `document` — Core Document

> Schema: [`/v1/profiles/document`](https://content.api.npr.org/v1/profiles/document) · Docs: [document](https://npr.github.io/content-distribution-service/api-reference/profiles/document.html)

A document that can be stored and retrieved with the content service. This schema is the 'base' schema to which all CSv1 documents must conform to.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | documentId | ✓ | The identifier used to uniquely reference this document |
| `profiles` | array<link> | ✓ | List of profiles that this document is intended to implement |
| `isRestrictedToAuthorizedOrgServiceIds` | boolean |  | Is this document restricted from distribution outside of the authorized ids listed in authorizedOrgServiceIds |
| `authorizedOrgServiceIds` | array<string> |  | List of org service IDs compatible with the Organization v4 Service. If a client's authorized services list contains any services that are also in this list, then the client will be permitted to modify or delete this document |
| `meta` | object |  | This section contains CSv1 metadata about this document. This section should not be altered by clients; if present, it should be returned as-is on update. |

---

### `external-link` — External Link

> Schema: [`/v1/profiles/external-link`](https://content.api.npr.org/v1/profiles/external-link) · Docs: [external-link](https://npr.github.io/content-distribution-service/api-reference/profiles/external-link.html)

An designation for content representing a link to external content. Intended to be used as an 'interface'.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `externalLink` | external-link & no-rels-link | ✓ | A link to an external document |
| `linkText` | string |  | Display text representing the document being linked to. |
| `linkLabel` | string |  | DEPRECATED/REMOVE: A short space to highlight additional metadata attributed to the linked content. |

---

### `has-audio` — Has Audio

> Schema: [`/v1/profiles/has-audio`](https://content.api.npr.org/v1/profiles/has-audio) · Docs: [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio.html)

A document with audio components

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `audio` | array<asset-link & object> | ✓ | The assets or documents representing the audio content of this document |

---

### `has-corrections` — Has Corrections

> Schema: [`/v1/profiles/has-corrections`](https://content.api.npr.org/v1/profiles/has-corrections) · Docs: [has-corrections](https://npr.github.io/content-distribution-service/api-reference/profiles/has-corrections.html)

A document with corrections

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `corrections` | array<asset-link> | ✓ | a collection of links to correction assets |

---

### `has-galleries` — Has Galleries

> Schema: [`/v1/profiles/has-galleries`](https://content.api.npr.org/v1/profiles/has-galleries) · Docs: [has-galleries](https://npr.github.io/content-distribution-service/api-reference/profiles/has-galleries.html)

A document with gallery assets

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `galleries` | array<asset-link> | ✓ | The assets or documents representing the gallery content of this document |

---

### `has-html-blocks` — Has HTML Blocks

> Schema: [`/v1/profiles/has-html-blocks`](https://content.api.npr.org/v1/profiles/has-html-blocks) · Docs: [has-html-blocks](https://npr.github.io/content-distribution-service/api-reference/profiles/has-html-blocks.html)

A document with html block assets

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `html-blocks` | array<asset-link> | ✓ | The assets or documents representing the html block content of this document |

---

### `has-images` — Has Images

> Schema: [`/v1/profiles/has-images`](https://content.api.npr.org/v1/profiles/has-images) · Docs: [has-images](https://npr.github.io/content-distribution-service/api-reference/profiles/has-images.html)

A document with image assets

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `images` | array<asset-link & object> | ✓ | The assets or documents representing the images of this document |

---

### `has-notes` — Has Notes

> Schema: [`/v1/profiles/has-notes`](https://content.api.npr.org/v1/profiles/has-notes) · Docs: [has-notes](https://npr.github.io/content-distribution-service/api-reference/profiles/has-notes.html)

A document with notes

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `notes` | array<asset-link & object> | ✓ | A collection of links to note assets |

---

### `has-premium-audio` — Has Premium Audio

> Schema: [`/v1/profiles/has-premium-audio`](https://content.api.npr.org/v1/profiles/has-premium-audio) · Docs: [has-premium-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-premium-audio.html)

A document with premium audio

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `premiumAudio` | array<asset-link & object> | ✓ | Links to the assets or documents representing premium audio content for this document |

---

### `has-social-handles` — Has Social Handles

> Schema: [`/v1/profiles/has-social-handles`](https://content.api.npr.org/v1/profiles/has-social-handles) · Docs: [has-social-handles](https://npr.github.io/content-distribution-service/api-reference/profiles/has-social-handles.html)

A document with social handles

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `socialHandles` | array<asset-link & object> | ✓ | a collection of links to social-handle assets used to identify accounts on social platforms |

---

### `has-videos` — Has Videos

> Schema: [`/v1/profiles/has-videos`](https://content.api.npr.org/v1/profiles/has-videos) · Docs: [has-videos](https://npr.github.io/content-distribution-service/api-reference/profiles/has-videos.html)

A document with video assets

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `videos` | array<asset-link> | ✓ | The assets or documents representing the video content of this document |

---

### `homepage` — Homepage

> Schema: [`/v1/profiles/homepage`](https://content.api.npr.org/v1/profiles/homepage) · Docs: [homepage](https://npr.github.io/content-distribution-service/api-reference/profiles/homepage.html)

A document which displays ordered homepage content.

_No properties defined — see raw schema._

---

### `html-block` — Html Block

> Schema: [`/v1/profiles/html-block`](https://content.api.npr.org/v1/profiles/html-block) · Docs: [html-block](https://npr.github.io/content-distribution-service/api-reference/profiles/html-block.html)

An asset representing freeform HTML content.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `html` | string | ✓ | The HTML representation of the content for this asset. |
| `title` | string |  | The title of the HTML representation. |

---

### `html-card` — HTML Card

> Schema: [`/v1/profiles/html-card`](https://content.api.npr.org/v1/profiles/html-card) · Docs: [html-card](https://npr.github.io/content-distribution-service/api-reference/profiles/html-card.html)

A card document which features html for display

_No properties defined — see raw schema._

---

### `image` — Image

> Schema: [`/v1/profiles/image`](https://content.api.npr.org/v1/profiles/image) · Docs: [image](https://npr.github.io/content-distribution-service/api-reference/profiles/image.html)

An image asset

**Extends:** `sizable-asset`

---

### `image-gallery` — Image Gallery

> Schema: [`/v1/profiles/image-gallery`](https://content.api.npr.org/v1/profiles/image-gallery) · Docs: [image-gallery](https://npr.github.io/content-distribution-service/api-reference/profiles/image-gallery.html)

A image gallery document which contains sequential image document assets

**Extends:** `document-with-container-profile`

---

### `inset` — Inset

> Schema: [`/v1/profiles/inset`](https://content.api.npr.org/v1/profiles/inset) · Docs: [inset](https://npr.github.io/content-distribution-service/api-reference/profiles/inset.html)

A document that contains inner content as an aside from the main flow of content within the given context.

**Extends:** `has-layout`

---

### `internal-link` — Internal Link

> Schema: [`/v1/profiles/internal-link`](https://content.api.npr.org/v1/profiles/internal-link) · Docs: [internal-link](https://npr.github.io/content-distribution-service/api-reference/profiles/internal-link.html)

A designation that a content document within the Content Service is referenced. Intended to be used as an 'interface'.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `documentLink` | internal-document-link & no-rels-link | ✓ | A link to a content service document |
| `linkText` | string |  | Display text representing the document being linked to. |
| `linkLabel` | string |  | DEPRECATED/REMOVE: A short space to highlight additional metadata attributed to the linked content. |

---

### `list` — List

> Schema: [`/v1/profiles/list`](https://content.api.npr.org/v1/profiles/list) · Docs: [list](https://npr.github.io/content-distribution-service/api-reference/profiles/list.html)

A list document which contains sequential document assets

**Extends:** `document-with-container-profile`, `sizable-asset`

---

### `listenable` — Listenable

> Schema: [`/v1/profiles/listenable`](https://content.api.npr.org/v1/profiles/listenable) · Docs: [listenable](https://npr.github.io/content-distribution-service/api-reference/profiles/listenable.html)

A document with audio components

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `profiles` | array |  |  |
| `audio` | array<link> | ✓ | The assets or documents representing the audio content of this document |

---

### `music-artist` — Music Artist

> Schema: [`/v1/profiles/music-artist`](https://content.api.npr.org/v1/profiles/music-artist) · Docs: [music-artist](https://npr.github.io/content-distribution-service/api-reference/profiles/music-artist.html)

A music artist document which aggregates other documents related to them

_No properties defined — see raw schema._

---

### `music-genre` — Music Genre

> Schema: [`/v1/profiles/music-genre`](https://content.api.npr.org/v1/profiles/music-genre) · Docs: [music-genre](https://npr.github.io/content-distribution-service/api-reference/profiles/music-genre.html)

A music genre document which aggregates other documents of similar genre.

_No properties defined — see raw schema._

---

### `newscast` — Newscast

> Schema: [`/v1/profiles/newscast`](https://content.api.npr.org/v1/profiles/newscast) · Docs: [newscast](https://npr.github.io/content-distribution-service/api-reference/profiles/newscast.html)

A newscast

---

### `note` — Note

> Schema: [`/v1/profiles/note`](https://content.api.npr.org/v1/profiles/note) · Docs: [note](https://npr.github.io/content-distribution-service/api-reference/profiles/note.html)

A note which is intended to be accompanying a document in CDS that the note is inserted into.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | string |  | An optional title for the note. |
| `text` | string | ✓ | Text of the given note which is intended to accompany a given document. |
| `dateTime` | string(date-time) | ✓ | UTC timestamp of when the note was added to the document. |

---

### `player-video` — Player Video

> Schema: [`/v1/profiles/player-video`](https://content.api.npr.org/v1/profiles/player-video) · Docs: [player-video](https://npr.github.io/content-distribution-service/api-reference/profiles/player-video.html)

A video asset representing a non-streaming video

**Extends:** `video`

---

### `podcast-category` — Podcast Category

> Schema: [`/v1/profiles/podcast-category`](https://content.api.npr.org/v1/profiles/podcast-category) · Docs: [podcast-category](https://npr.github.io/content-distribution-service/api-reference/profiles/podcast-category.html)

A category representing a collection of podcasts

_No properties defined — see raw schema._

---

### `podcast-channel` — Podcast Channel

> Schema: [`/v1/profiles/podcast-channel`](https://content.api.npr.org/v1/profiles/podcast-channel) · Docs: [podcast-channel](https://npr.github.io/content-distribution-service/api-reference/profiles/podcast-channel.html)

A document containing metadata about a podcast channel

**Extends:** `document-with-aggregation-profile`

---

### `podcast-episode` — Podcast Episode

> Schema: [`/v1/profiles/podcast-episode`](https://content.api.npr.org/v1/profiles/podcast-episode) · Docs: [podcast-episode](https://npr.github.io/content-distribution-service/api-reference/profiles/podcast-episode.html)

A single episode of a podcast

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `copyright` | string |  | The copyright policy applied to this podcast episode represented in HTML |
| `episodeGuid` | string |  | Episode GUID for purposes of generating a link |
| `episodePermalink` | link |  | Permalink for this episode |
| `episodeNumber` | integer |  | This episode's number within the season (if season is present) |
| `seasonNumber` | integer |  | This episode's season number |
| `explicit` | boolean | ✓ | Indicator of if this episode contains explicit content |
| `episodeType` | enum("full" \| "trailer" \| "bonus") | ✓ | The type of this episode |
| `itunes` | object | ✓ | iTunes-specific metadata about this episode |
| `feedEpisodeTitle` | string |  | Episode title as it appears in podcast feeds |
| `editorialMajorUpdateDateTime` | string(date-time) |  | The date and time at which the content of this podcast-episode received significant editorial updates |

---

### `program` — Program

> Schema: [`/v1/profiles/program`](https://content.api.npr.org/v1/profiles/program) · Docs: [program](https://npr.github.io/content-distribution-service/api-reference/profiles/program.html)

A regularly scheduled program

_No properties defined — see raw schema._

---

### `program-episode` — Program Episode

> Schema: [`/v1/profiles/program-episode`](https://content.api.npr.org/v1/profiles/program-episode) · Docs: [program-episode](https://npr.github.io/content-distribution-service/api-reference/profiles/program-episode.html)

An episode of a program

**Extends:** `document-with-aggregation-profile`

---

### `promo-card` — Promo Card

> Schema: [`/v1/profiles/promo-card`](https://content.api.npr.org/v1/profiles/promo-card) · Docs: [promo-card](https://npr.github.io/content-distribution-service/api-reference/profiles/promo-card.html)

A card document which promotes another piece of content

**Extends:** `card`, `sizable-asset`

---

### `publishable` — Publishable

> Schema: [`/v1/profiles/publishable`](https://content.api.npr.org/v1/profiles/publishable) · Docs: [publishable](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable.html)

A publishable document.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | string | ✓ | A human-readable title for this document |
| `subtitle` | string |  | An additional description of the document, potentially longer than a title |
| `socialTitle` | string |  | An additional description of the document, for social media |
| `teaser` | string |  | A description of the content contained in this document. |
| `shortTeaser` | string |  | A short description of the content |
| `contributionNotes` | string |  | A description of the content contributions |
| `collections` | array<collectionLink> |  | List of links to collections containing this document |
| `brandings` | array<organizationLink> | ✓ | The organization(s) whose branding should be used for this document |
| `owners` | array<organizationLink> | ✓ | The organization(s) who have ownership of (or an association with) this document. This is used for determining how documents should show up in searches. |
| `publishDateTime` | string(date-time) |  | The editorially-defined publish date for this document in RFC3339 format (ex: '2020-01-01T00:00:00Z') |
| `bylines` | array<noRelAssetLink> |  | The byline assets or documents for this document. |
| `corrections` | array<noRelAssetLink> |  | The assets or documents describing corrections made to this document. |
| `assets` | object |  | This object contains subdocuments embedded and utilized in this document. These subdocuments are stored using their ID as the parameter. |
| `webPages` | array<webPageLink> |  | Links to web pages where more information about this document can be found |
| `recommendUntilDateTime` | string(date-time) |  | The date and time at which this document should no longer be recommended to end users. This does not, however, invalidate the content of the document. |
| `relatedItems` | array<relatedItemLink> |  | Links to documents with associative relationships with this document. |
| `editorialLastModifiedDateTime` | string(date-time) |  | The date and time at which the content of this document received editorial updates |
| `archivedDateTime` | string(date-time) |  | The date and time when this content became no longer actively updated, in RFC3339 format. |
| `profileExclusions` | array<no-rels-link> |  | When considering this document for client profiles, these profiles will NOT be considered. |

---

### `pull-quote` — Pull Quote

> Schema: [`/v1/profiles/pull-quote`](https://content.api.npr.org/v1/profiles/pull-quote) · Docs: [pull-quote](https://npr.github.io/content-distribution-service/api-reference/profiles/pull-quote.html)

A text callout for quotes in the body of the same object. Used as a type

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `quote` | string | ✓ | The text of the quote itself |
| `attributionParty` | string |  | Who said the quote, if needed |
| `attributionContext` | string |  | When or in what context the quote was given. Attribution party must be populated if this field is used |

---

### `reference-byline` — Reference Byline

> Schema: [`/v1/profiles/reference-byline`](https://content.api.npr.org/v1/profiles/reference-byline) · Docs: [reference-byline](https://npr.github.io/content-distribution-service/api-reference/profiles/reference-byline.html)

A byline representing a person or other entity responsible for the creation of this document. The person or entity represented by this asset should hold attributable responsibility for a portion of the content represented in this document. The data relating to the individual/entity will be provided through the links defined within

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `bylineDocuments` | array | ✓ | Links to internal documents where more information about this byline can be found |

---

### `renderable` — Renderable

> Schema: [`/v1/profiles/renderable`](https://content.api.npr.org/v1/profiles/renderable) · Docs: [renderable](https://npr.github.io/content-distribution-service/api-reference/profiles/renderable.html)

Renderable document content for visual display/presentation

**Extends:** `has-layout`

---

### `resource-container` — Resource Container

> Schema: [`/v1/profiles/resource-container`](https://content.api.npr.org/v1/profiles/resource-container) · Docs: [resource-container](https://npr.github.io/content-distribution-service/api-reference/profiles/resource-container.html)

A container document with size and content descriptors

**Extends:** `container`

---

### `series` — Series

> Schema: [`/v1/profiles/series`](https://content.api.npr.org/v1/profiles/series) · Docs: [series](https://npr.github.io/content-distribution-service/api-reference/profiles/series.html)

A series document which aggregates other documents into a series.

_No properties defined — see raw schema._

---

### `social-handle` — Social Handle

> Schema: [`/v1/profiles/social-handle`](https://content.api.npr.org/v1/profiles/social-handle) · Docs: [social-handle](https://npr.github.io/content-distribution-service/api-reference/profiles/social-handle.html)

string handles used to identify an account on a social platform

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `platform` | enum("facebook" \| "twitter" \| "instagram" \| "tumblr" \| "pinterest") | ✓ |  |
| `handle` | string | ✓ |  |

---

### `story` — Story

> Schema: [`/v1/profiles/story`](https://content.api.npr.org/v1/profiles/story) · Docs: [story](https://npr.github.io/content-distribution-service/api-reference/profiles/story.html)

A publishable story document

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `editorialMajorUpdateDateTime` | string(date-time) |  | The date and time at which the content of this story received significant editorial updates |

---

### `stream-player-video` — Stream Player Video

> Schema: [`/v1/profiles/stream-player-video`](https://content.api.npr.org/v1/profiles/stream-player-video) · Docs: [stream-player-video](https://npr.github.io/content-distribution-service/api-reference/profiles/stream-player-video.html)

A video asset representing a streaming video

**Extends:** `video`

---

### `tag` — Tag

> Schema: [`/v1/profiles/tag`](https://content.api.npr.org/v1/profiles/tag) · Docs: [tag](https://npr.github.io/content-distribution-service/api-reference/profiles/tag.html)

A tag document which aggregates other documents with a shared common characteristic

_No properties defined — see raw schema._

---

### `text` — Text

> Schema: [`/v1/profiles/text`](https://content.api.npr.org/v1/profiles/text) · Docs: [text](https://npr.github.io/content-distribution-service/api-reference/profiles/text.html)

An asset representing text associated with a document

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | string | ✓ | The textual representation of the content for this asset (with optional formatting or markup). |

---

### `topic` — Topic

> Schema: [`/v1/profiles/topic`](https://content.api.npr.org/v1/profiles/topic) · Docs: [topic](https://npr.github.io/content-distribution-service/api-reference/profiles/topic.html)

A topic document which aggregates other documents related to it

_No properties defined — see raw schema._

---

### `transcript` — Transcript

> Schema: [`/v1/profiles/transcript`](https://content.api.npr.org/v1/profiles/transcript) · Docs: [transcript](https://npr.github.io/content-distribution-service/api-reference/profiles/transcript.html)

The transcript of an audio or video asset

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | string | ✓ | The text composing this transcript's content |

---

### `tweet` — Tweet

> Schema: [`/v1/profiles/tweet`](https://content.api.npr.org/v1/profiles/tweet) · Docs: [tweet](https://npr.github.io/content-distribution-service/api-reference/profiles/tweet.html)

An asset representing a tweet associated with a document. For more information on constructing a link/embed from this data, see https://developer.twitter.com/en/docs/twitter-ids.

**Extends:** `sizable-asset`

---

### `video-carousel-card` — Video Carousel Card

> Schema: [`/v1/profiles/video-carousel-card`](https://content.api.npr.org/v1/profiles/video-carousel-card) · Docs: [video-carousel-card](https://npr.github.io/content-distribution-service/api-reference/profiles/video-carousel-card.html)

A card document which features a video carousel for display

_No properties defined — see raw schema._

---

### `youtube-video` — YouTube Video

> Schema: [`/v1/profiles/youtube-video`](https://content.api.npr.org/v1/profiles/youtube-video) · Docs: [youtube-video](https://npr.github.io/content-distribution-service/api-reference/profiles/youtube-video.html)

An asset representing a YouTube video associated with a document. For more information on how to use this to construct a link/embed, see https://developers.google.com/youtube.

**Extends:** `sizable-asset`

