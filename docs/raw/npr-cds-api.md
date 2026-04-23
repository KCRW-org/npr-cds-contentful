# NPR CDS API Reference

> Source: https://npr.github.io/content-distribution-service/api-reference/
> Last fetched: 2026-04-23

The NPR Content Distribution Service (CDS) is a REST API for publishing and
retrieving structured content documents. Base URLs:

- Production: `https://content.api.npr.org`
- Staging: `https://stage-content.api.npr.org`

All requests require bearer-token auth. See the Getting Started section below
for authorization details.

Profile schemas (field-level reference) live in `npr-cds-profiles.md`.

---

## Getting Started

> Source: https://npr.github.io/content-distribution-service/getting-started.html

# Getting started



New to CDS? Get started here with this guide before moving on to the [API Reference](https://npr.github.io/content-distribution-service/api-reference).



- Authorization & Permissions Requesting a Key
- Read Permissions
- Write Permissions 1. Document Prefix
- 2. authorizedOrgServiceIds

  [Using an Authorization Token](#using-an-authorization-token)   [Getting started: Retrieving](#getting-started-retrieving)

- The anatomy of a document Document IDs
- Profiles
- Assets & subdocuments
- Inter-document links
- Organization data

    [Getting started: Publishing](#getting-started-publishing)

- Selecting profiles
- Assembling a document Step 1: ID
- Step 2: Profiles
- Step 3: Organizational data
- Step 4: Title

  [Publishing the document to CDS](#publishing-the-document-to-cds)

- A common question: Where do assets for a story come from?
- A note on dates in CDS documents

  [Next Steps](#next-steps)

# Authorization & Permissions



Clients in CDS have permissions based around their *Authorization Token*; this means the actions a client is authorized to take is tied to their token. Clients should only ever use their token for accessing CDS and tokens should be used with **one client only**. If you have another client you’d like to interact with CDS, let us know and we’ll supply an additional token! If your client needs additional permissions such as additional `authorizedOrgServiceIds`, please reach out to [Member Partnership](https://studio.npr.org/s/support-home)!



If your client is intending to publish content to CDS, we will also provide a document ID prefix to use. For more information on document ID prefixes, see [below](#1-document-prefix).



## Requesting a Key



If you are a Member Station and need a CDS key, reach out to [Member Partnership](https://studio.npr.org/s/support-home).



## Read Permissions



By default, **all Authorized clients have read access to all CDS data**. As long as a client is using a valid Authorization Token, there is no technical restrictions on which client can retrieve which data. However, there are guidelines to follow for *premium content*. [Please read this premium content guide](https://npr.github.io/content-distribution-service/legal/premium-content) and refer to the [CDS API Terms of Use](https://www.npr.org/about-npr/179876898/terms-of-use#APIContent) for information on how to handle premium content.



## Write Permissions



The documents a client can create/modify/delete in CDS are determined with the following rules:



### 1. Document Prefix



Every CDS client is assigned a string as its “document ID prefix”. All documents created by this client **MUST** have IDs that begin with this prefix.



As an example, if your client has the document ID prefix `tst`, some possible valid IDs would be:



```plaintext
tst-1234
tst-my-document
tst-tst-tst
```



Some **invalid** IDs would be:



```plaintext
1234
1234-tst
my-document-tst-1234
```



In addition to creation, clients are able to **modify** and **delete** any document with an ID matching their document ID prefix. That is to say, clients are able to modify and delete any document they’ve created!



### 2. authorizedOrgServiceIds



If a document does not have an ID prefix matching the client’s, that client can still modify or delete it if it has a matching `authorizedOrgServiceIds` entry.



Every CDS document has an attribute called `authorizedOrgServiceIds`; this attribute is defined in the [document](https://npr.github.io/content-distribution-service/api-reference/profiles/document) profile. This attribute is an array containing a list of Organization Service Service IDs; for an in-depth explanation of these IDs, see [the Organization Service documentation](https://npr.github.io/organization-service/data-types/services.html). An example of this array is below:



```json
"authorizedOrgServiceIds": [
  "s1",
  "s150"
]
```



Clients *also* have a list of authorized Organization Service IDs. When a client tries to modify or delete a document that has a non-matching prefix, CDS will compare the client’s authorized IDs against the document’s `authorizedOrgServiceIds` array. If there is a matching entry, the client is authorized. If there is no matching entry, the client’s action will be rejected and CDS will return a 403.



By default, clients have an empty set of authorized Organization Service IDs, meaning they can only modify and delete documents they have created. In order to add an ID to your client’s list, email [Member Partnership](https://studio.npr.org/s/support-home)!



## Using an Authorization Token



When interacting with an endpoint of CDS that requires Authorization, the Authorization Token must be provided as an `Authorization` bearer token header. An example using `curl` is below:



```plaintext
$ curl -s \
    -H 'Authorization: Bearer YOUR-TOKEN-GOES-HERE' \
    https://content.api.npr.org/v1/documents/1002
```



# Getting started: Retrieving



Data stored in CDS is stored as “documents”. Each document is represented as a JSON payload, which can be retrieved at any time from CDS.



There are two ways to retrieve content from CDS: **single-document retrieval** and **querying**. For now, let’s retrieve a single document.



Using your Authentication Token, place a `GET` request to `https://content.api.npr.org/v1/documents/773675421`. Using `curl`, this request might look like the following:



```plaintext
$ curl -s \
  -H 'Authorization: Bearer YOUR-TOKEN-HERE' \
  https://content.api.npr.org/v1/documents/773675421
```



You should receive a 200 response, with a JSON document body:



```json
{
  "resources": [
    {
      "id": "773675421",
      "profiles": [
        {
          "href": "/v1/profiles/story",
          "rels": [
            "type"
          ]
        },
...
```



Let’s take a look at some key parts of this document!



## The anatomy of a document



Every document must contain a set of standard attributes in order to be considered “valid” when published to CDS.



### Document IDs



```json
"id": "773675421"
```



Every document in CDS has an ID that identifies it. CDS IDs are strings conforming to a specific set of requirements; for more on generating valid IDs, see [publishing to CDS](#getting-started-publishing).



### Profiles



```json
"profiles": [
  {
    "href": "/v1/profiles/story",
    "rels": [
      "type"
    ]
  },
  ...
```



[CDS profiles](https://npr.github.io/content-distribution-service/api-reference/profiles/) are sets of constraints that a CDS document must conform to in order to be ingested. Documents list their own profiles; meaning that if a document lists [the story profile](https://npr.github.io/content-distribution-service/api-reference/profiles/story), then it is claiming that it conforms to the constraints set out by that profile.



At a bare minimum, all documents in CDS must list [the document profile](https://npr.github.io/content-distribution-service/api-reference/profiles/document) (and conform to its constraints). In order to be ingested as a *standalone* document, they must also list [the publishable profile](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable).



For a full list of profiles, see [the Profiles page](https://npr.github.io/content-distribution-service/api-reference/profiles).



### Assets & subdocuments



```json
"assets": {
  "773675422": {
    "id": "773675422",
    "profiles": [
      {
        "href": "/v1/profiles/audio",
        "rels": [
          "type"
        ]
      },
...
```



Publishable CDS documents can contain “assets” (also called “subdocuments”). Assets themselves *are documents*; meaning they have IDs and profiles! As documents, they have to list [the document profile](https://npr.github.io/content-distribution-service/api-reference/profiles/document).



Assets represent pieces of a document; these can be [blocks of text](https://npr.github.io/content-distribution-service/api-reference/profiles/text), [pieces of audio](https://npr.github.io/content-distribution-service/api-reference/profiles/audio), [images](https://npr.github.io/content-distribution-service/api-reference/profiles/image), or more. All are stored in the `assets` attribute, which is a JSON object storing each asset with its `id` as the key.



### Inter-document links



```json
"collections": [
  {
    "href": "/v1/documents/1122",
    "rels": [
        "topic",
        "theme",
        "slug"
    ],
...
```



CDS documents can contain relative to links to other documents. These links indicate inter-document relationships. Document links are, by definition, one-way relationships (although a two-way relationship can be established by linking each document to the other).



The `collections` array is the most common method of establishing a relationship between documents; loosely, it indicates that one document “belongs” to another document’s collection. For more information on collections, see [the collections documentation](https://npr.github.io/content-distribution-service/api-reference/core-concepts/collections/).



### Organization data



```json
"owners": [
  {
    "href": "https://organization.api.npr.org/v4/services/s1"
  }
]
```



```json
"brandings": [
  {
    "href": "https://organization.api.npr.org/v4/services/s1"
  }
]
```



In addition to linking to other documents, CDS documents can link to *organizational data*; that is, a document can have a relationship with an organizational entity. These relationships are defined by the `owners` and `brandings` arrays. For information on how to use these arrays and links, see [the publishable profile documentation](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable).



This document links to Services defined via NPR’s Organization Service (“Org V4”). While CDS does not *guarantee* that all organizational information will be hosted by Org V4, this is the most common case. For more information on Org V4, see [the public Organization Service documentation](https://npr.github.io/organization-service/).



# Getting started: Publishing



**NOTE**: This section is only applicable to clients with write-permissions to CDS. If your client does not have write permissions, this section may not be useful to you.



Publishing data to CDS is the process of serializing a document, then sending it to CDS for validation and ingestion. This involves several steps:



- Selecting a set of profiles that the document is intended to implement
- Assembling a document based on those profiles
- Making a call to CDS with the document’s data



This process is the same for documents being newly created, or existing documents being re-published with updates.



## Selecting profiles



The [profiles](https://npr.github.io/content-distribution-service/api-reference/profiles/) present on a document determine the overall structure. Before a document can be created and ingested into CDS, a set of profiles must be selected for it. These profiles will define what attributes exist on the document itself, and what format they should take.



At minimum, all standalone documents published to CDS must list the following:



- The document profile
- The publishable profile



Documents may also list and implement any profile from [the profiles list](https://npr.github.io/content-distribution-service/api-reference/profiles/).



Once the set of profiles is assembled, one must be selected as the `type` profile. The `type` profile indicates to clients that this profile should be considered when determining the primary method of handling this document.



## Assembling a document



This section walks through the process of assembling a document piece by piece into a full JSON payload. Obviously, this is just an example; in real life, CDS documents are generated automatically by various upstream clients. But hopefully this provides some insight into how a new client should go about assembling a document.



Our document will start as an empty JSON object:



```json
{}
```



As we go through the following steps, we’ll add attributes and fields to this object until we have a full, publishable CDS document.



### Step 1: ID



The first step to creating a document is to define the `id` field. IDs must be unique across standalone documents; if a document is published with the same ID as an existing CDS document, it’s considered an update (not a creation).



When choosing an ID, clients must conform to the following rules:



- The ID must begin with the prefix defined for the client. For example, if my client was assigned the prefix abc, all documents my client produces must begin with the string abc (so, for example, abc-1, abc-2, etc.)
- The ID must only contain lowercase alphanumeric characters and dashes.



Document IDs will be validated against [the document ID schema](https://content.api.npr.org/v1/schemas/documentId); if an ID does not match this schema, it will be rejected.



```json
{
    "id": ""
}
```



### Step 2: Profiles



Each profile you’ve selected for your document must be listed as a link in the document’s `profiles` array. Each entry in this array will be an object with an `href` attribute, the value of which will be the relative link to the profile itself. So if your document is listing the `story` profile, it will contain the following entry in its `profiles` array:



```json
{
    "href": "/v1/profiles/story"
}
```



The `type` profile should have an additional `rels` array with the `"type"` string present:



```json
{
    "href": "/v1/profiles/story",
    "rels": ["type"]
}
```



The document so far:



```json
{
    "id": "",
    "profiles": [
        {
            "href": "/v1/profiles/publishable",
            "rels": ["interface"]
        },
        {
            "href": "/v1/profiles/document"
        },
        {
            "href": "/v1/profiles/story",
            "rels": ["type"]
        }
    ]
}
```



### Step 3: Organizational data



In order to be searchable and brandable, the document needs to link to some organization data. Your orgnization should have a Service ID that it is assigned for these purposes; if it doesn’t, reach out to [NPR Digital Media](mailto:onlinetech@npr.org) to find out what it is.



The `owners` and `brandings` arrays will contain links to your Service’s entry in [the Organization Service](https://npr.github.io/organization-service/); each of these arrays have different functions, but in this case both should contain the same entry. For more information on these arrays and their usages, see [the publishable profile](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable) documentation.



Add both `owners` and `brandings` to your document. In these arrays, add an object with an `href` attribute, the value of which will be:



```plaintext
"https://organization.api.npr.org/v4/services/"
```



All together, the document will look like the following:



```json
{
    "id": "",
    "profiles": [
        {
            "href": "/v1/profiles/publishable",
            "rels": ["interface"]
        },
        {
            "href": "/v1/profiles/document"
        },
        {
            "href": "/v1/profiles/story",
            "rels": ["type"]
        }
    ],
    "owners": [
        {
            "href": "https://organization.api.npr.org/v4/services/"
        }
    ],
    "brandings": [
        {
            "href": "https://organization.api.npr.org/v4/services/"
        }
    ]
}
```



### Step 4: Title



The final step to assembling a document is adding a title:



```json
{
    "id": "",
    "title": "",
    "profiles": [
        {
            "href": "/v1/profiles/publishable",
            "rels": ["interface"]
        },
        {
            "href": "/v1/profiles/document"
        },
        {
            "href": "/v1/profiles/story",
            "rels": ["type"]
        }
    ],
    "owners": [
        {
            "href": "https://organization.api.npr.org/v4/services/"
        }
    ],
    "brandings": [
        {
            "href": "https://organization.api.npr.org/v4/services/"
        }
    ]
}
```



Your document is complete!



## Publishing the document to CDS



Once the document is assembled, the final step is to publish it to CDS. Using your authorization token, make a `PUT` call to the `/v1/documents/` endpoint; set the body to the document you’ve assembled.



Using `curl`, this call would look like:



```plaintext
$ curl -s \
    -X PUT \
    -H 'Authorization: Bearer ' \
    -d '@./path/to/your/document.json' \
    https://content.api.npr.org/v1/documents/
```



If successful, this call should return a 200 status code, and a copy of the document CDS has ingested. The document itself will be cleaned and have additional metadata provided by the ingestion process.



#### A common question: Where do assets for a story come from?



**You’ll notice the example we just went through has no mention of images, video or anything embellishing the story. Where do those pieces of content come from in CDS?



Documents in CDS can contain a variety of assets, all found within the `assets` array as defined in the [publishable](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable) profile. `assets` will have within itself an array of key-value pairs. The `key` will be an `Asset ID` that you generate. The `value` is the JSON representing the asset as it conforms to the selected profile type (e.g. [audio](https://npr.github.io/content-distribution-service/api-reference/profiles/audio)).



What is the protocol for an asset ID? The only protocol is that the asset ID *must be unique **within your CDS document***. It does *not* have to universally unique; all the links for your assets will be **internal links** meaning we’re only pointing to another location *within the current JSON* and not within all of CDS. So how to make an asset ID? You can enumerate integers, you can attach a prefix of e.g. `audio` for audio assets and a an enumerated digit or GUID and so on. It’s up to you! The only rule is that you *keep it unique within your document you’re publishing*.



#### A note on dates in CDS documents



Throughout the [profiles](https://npr.github.io/content-distribution-service/api-reference/profiles) you will see mention of date fields using the [RFC3339 format](https://datatracker.ietf.org/doc/html/rfc3339). Please note that these fields *also need to use [UTC time](https://en.wikipedia.org/wiki/Coordinated_Universal_Time)* in order for our analytics services and other services that use date queries to pick up your content. See [our tutorial on UTC time for more help](https://npr.github.io/content-distribution-service/api-reference/tutorials/utc-time).



## Next Steps



To dive in further on CDS and get into Core Concepts, full API documentation for endpoints and to learn more about profiles, [See our API Reference](https://npr.github.io/content-distribution-service/api-reference).

---

## Core Concepts: Querying

> Source: https://npr.github.io/content-distribution-service/api-reference/core-concepts/querying/

- Querying CDS
- Filtering Filtering query parameters Boolean logic in queries
- Date values
- Valid filtering query parameters

    [Pagination](#pagination)

- Pagination query parameters offset and limit
- Pagination limits
- Valid pagination query parameters

  [Sorting](#sorting)

- Sorting query parameters
- Editorial sort
- Valid sort types
- More on CDS sorting behavior
- Optional :first and :last params
- Example queries :first and :last param Base behavior example: sorting on only seasonNumber with NO :first and :last
- And now WITH :first and :last specified
- :first and :last when sorting on multiple fields
- :first and :last when sorting on multiple fields – “descending” order
- Different direction and missing values for each field



# Querying CDS



Querying CDS is done by placing an authenticated HTTP request against the `/v1/documents` resource with zero or more query parameters.



Valid query parameters for CDS can be broken up into several broad categories:



- Filtering
- Sorting
- Pagination



# Filtering



Filtering query parameters limit the results returned by a CDS query to only documents that match a certain set of characteristics. Some examples include `profileIds` (filters to only documents containing a given profile) and `collectionIds` (filters to only documents that are part of a given collection).



## Filtering query parameters



Filtering query parameters limit the results returned by a CDS query to only those matching a certain set of characteristics.



### Boolean logic in queries



Some filtering query parameters allow for multiple values to be specified; an example is `profileIds`. When multiple values are specified for a single query parameter, this becomes a logical `OR` operation. For example, see the following parameter:



```plaintext
profileIds=renderable,listenable
```



This parameter would filter results to documents that contain the `renderable` profile OR the `listenable` profile.



When multiple query parameters are present, this is interpreted as a logical `AND` operation. See the following example:



```plaintext
profileIds=renderable&collectionIds=1002
```



This query would filter results to documents that contain the `renderable` profile AND are part of the `1002` collection. Note that query parameters can be present more than once in a single query:



```plaintext
profileIds=renderable&profileIds=listenable
```



The above query would filter results to documents that have both the `renderable` profile AND the `listenable` profile. Any filtering query parameter can be used with an AND operator.



Some query parameters (ex: `profileIds`) have a corresponding `excluded` parameter (ex: `excludedProfileIds`). These allow you to make queries while telling CDS which documents you do NOT want to be returned. For example:



```plaintext
profileIds=story&excludedProfileIds=has-images,has-audio
```



This query would filter results to documents containing the `story` profile BUT containing NEITHER the `has-images` profile NOR the `has-audio` profile. In other words, each story document returned would NOT contain the `has-images` profile AND would NOT contain the `has-audio` profile.



Note that by combining query parameters and multiple values, complex boolean operations can be created:



```plaintext
profileIds=renderable,listenable&collectionIds=1001,1002&profileIds=podcast-episode
```



The above query can be expressed with the following boolean expression:



```plaintext
(profileIds contains "renderable" OR profileIds contains "listenable") AND
(document in collection 1001 OR document in collection 1002) AND
(profileIds contains podcast-episode)
```



### Date values



Some filtering query parameters require full-date or date-time values. These query parameters will support [RFC3339](https://datatracker.ietf.org/doc/html/rfc3339) format date-times (ex: `2022-01-01T00:00:00Z`) or full-dates (ex: `2022-01-01`).



These parameters can be given as single values, such as in the following examples:



```plaintext
publishDateTime=2022-01-01T00:00:00Z
publishDateTime=2022-01-01
```



When a date-time is given, the value in the document must match the given value *exactly* to be returned. When a full-date is given, any document with a value falling between `00:00:00` and `23:59:59` on the given date will be returned.



Date ranges can also be specified using the ellipses (`...`) operator:



```plaintext
publishDateTime=2022-01-01T00:00:00Z...
publishDateTime=...2022-12-31T23:59:59Z
publishDateTime=2022-01-01T00:00:00Z...2022-12-31T23:59:59Z
```



When the ellipses are present after a value, it indicates that any document with a value greater than or equal to the given value is eligible to be returned. When the ellipses preceed a value, any document with a less than or equal value will be returned.



When full-date values are used with ellipses, they are interpreted as a date-time based on where they are in the range. Full-dates starting a range will be intepreted as having the `00:00:00` time, and full-dates ending a range will be interpeted as having the `23:59:59` time.



***IMPORTANT NOTE:***



At present, if a request specifies an [RFC3339](https://www.ietf.org/rfc/rfc3339.txt) `full-date` (e.g. `2022-01-01`), ***CDS will automatically append the Eastern Standard Time (EST) time-zone offset to that date.***



This is equivalent to: `2022-01-01T00:00:00-05:00`.



However, if a client explicitly defines a valid [RFC3339](https://www.ietf.org/rfc/rfc3339.txt) `date-time` string (e.g. `2022-01-01T00:00:00-08:00`, which translates to exactly midnight in PST), ***this automatic appending of EST does not occur, and the explicit `date-time` is used.***



```plaintext
publishDateTime=2022-01-01...2022-01-02
```



In the above example, any document with a `publishDateTime` value between `2022-01-01T00:00:00-05:00` and `2022-01-02T23:59:59-05:00` is eligible to be returned.



(See above for why and when the `-05:00` is appended.)



In all cases, if a parameter accepts date-time values, it will also accept full-date values. Certain parameters will only accept full-date values; see the `showDates` parameter below.



### Valid filtering query parameters



| Name | Supports multiple values? | Date values? | Description |
| --- | --- | --- | --- |
| collectionIds | Yes | No | A list of one or more [collection IDs/content-distribution-service/api-reference/core-concepts/collections/) to filter by; only documents present in one or more of the given collections will be returned. Example: collectionIds=1001,1002 |
| editorialLastModifiedDateTime | No | Yes | A date or date range; only documents with a editorialLastModifiedDateTimeValue within the given range will be returned.Example: editorialLastModifiedDateTime=2021-01-01T00:00:00Z |
| excludedOwnerHrefs | Yes | No | A list of one or more URIs to filter out; documents containing one or more of the given URIs in their owners array will NOT be returned Example: excludedOwnerHrefs=https://organization.api.npr.org/v4/services/s583 |
| excludedIds | Yes | No | A list of one or more document IDs to filter out; documents containing one or more of the given document IDs will NOT be returned Example: excludedIds=1002,1045,1006 |
| excludedProfileIds | Yes | No | A list of one or more profile IDs to filter out; documents containing one or more of the given profiles at the top level will NOT be returned Example: excludedProfileIds=renderable |
| ids | Yes | No | A list of one or more document IDs to filter by; only documents with IDs in the given set will be returned Example: ids=1002,1045,1006 |
| ownerHrefs | Yes | No | A list of one or more URIs to filter by; only documents containing one or more of the given URIs in their owners array will be returned Example: ownerHrefs=https://organization.api.npr.org/v4/services/s583 |
| nprWebsitePaths | Yes | No | A list of one or more website paths; only documents containing the path in their nprWebsitePaths will be returned. Example of a path that will match: nprWebsitePaths=/podcasts/510310/npr-politics-podcast |
| profileIds | Yes | No | A list of one or more profile IDs to filter by; only documents containing one or more of the given profiles at the top level will be returned Example: profileIds=renderable |
| publishDateTime | No | Yes | A date or date range; only documents with a publishDateTimeValue within the given range will be returned.Example: publishDateTime=2021-01-01T00:00:00Z |
| recommendUntilDateTime | No | Yes | A date or date range; only documents with a recommendUntilDateTimeValue within the given range will be returned.Example: recommendUntilDateTime=2021-01-01T00:00:00Z |
| showDates | No | Yes | A date or date range; only documents with a showDates entry within the given range will be returned. This parameter will not accept date-time values.Example: showDates=2022-01-01 |
| seasonNumber | No | No | A single numerical value corresponding to the seasonNumber value found on some CDS documents.Example: seasonNumber=1See: podcast-episode profile |



# Pagination



When CDS determines which documents are “eligible” to be returned for a query, it uses the pagination query parameters to determine which subset of documents are actually returned to the client. By default, CDS will only return the first 20 documents.



## Pagination query parameters



By default, a CDS query will return 20 documents; however, there may be more than 20 documents matching a given query. Pagination query parameters allow clients to control how many documents are returned from a query, and which subset are returned.



When using pagination query parameters, it’s important to note that every query is evaluated *independently*; that is, CDS does not support cursor-based querying. When two queries are made in quick succession, the results may change between the two based on publishing activity.



### offset and limit



The two valid pagination query parameters are `offset` and `limit`. When a query is made against CDS, a (potentially large) set of documents are “eligible” to be returned. CDS will return the first subset of documents starting at the `offset` value, up to a maximum number of documents defined by `limit`. `offset` is 0-based, so `offset=0` indicates the first document in the set.



This is illustrated by the diagram below:





### Pagination limits



For a single query request, CDS has a hard limit of 300 documents; requesting more than 300 documents in a query will result in a 400 error. For a full set of documents, CDS will not return results beyond the 2000th document. That’s to say, `limit + offset` must always be less than or equal to 2000.



### Valid pagination query parameters



| Name | Max value | Default | Description |
| --- | --- | --- | --- |
| limit | 300 | 20 | The maximum number of documents to return in this query |
| offset | 2000 | 0 | Where to “start” the subset of documents returned by this query. This value is 0-based. |



## Sorting



When documents are returned by a CDS query, they are ordered by their `publishDateTime` attribute, starting from most recent to least recent (“descending”). The `sort` attribute can alter this ordering.



### Sorting query parameters



The order that documents are returned in a query is determined by the query’s sort. By default, queries are sorted by their `publishDateTime` attribute, descending (most recent first, least recent last).



This sort can be changed using the `sort` parameter. The sort parameter takes the following form:



```plaintext
sort=[:[:]][,[:[:]]]
```



| Parameter Name | Required? | Function |
| --- | --- | --- |
| type | Yes | The name of the field to be sorted on. (See the valid sort types below.) |
| direction | Yes | The desired sorting order: asc (ie. smallest → largest) or desc (ie. largest → smallest). |
| missing | No | The desired behavior for documents that are missing the property being sorted on. (More info on this parameter) |



CDS *does* support sorting on multiple fields (ie. multi-dimensional sort). The exact details of that behavior are outlined [below](#more-on-cds-sorting-behavior).



An example of descending `publishDateTime` sort would be:



```plaintext
sort=publishDateTime:desc
```



The `type` value determines the method of sorting the documents. If present, the `direction` value determines whether the documents will be sorted in ascending or descending order. The direction value is optional, and not all sort types support a direction; see `editorial` sort below.



When valid and present, the `direction` value may be either `asc` or `desc` for “ascending” or “descending”, respectively. When valid but missing, `direction` defaults to `desc`.



An example using the optional `missing` param would be:



```plaintext
...sort=seasonNumber:desc:first
```



This means that our results will be sorted by the `seasonNumber` field, in descending order (ie. highest → lowest).



### Editorial sort



The `editorial` sort is a method of ordering CDS documents within a [collection/content-distribution-service/api-reference/core-concepts/collections). It may not be used with a direction, and must be used in conjuction with a single `collectionIds` query parameter (see [Filtering](#filtering) for more details on this parameter).



When given, editorial sort will place *ordered content before unordered content*. When querying for a collection, ordered content will be returned first in the order it appears in the `items` array, followed by all unordered content sorted by `publishDateTime`.



For more information on collections, see the [Collections/content-distribution-service/api-reference/core-concepts/collections) page.



### Valid sort types



| Name | Supports direction? | Description |
| --- | --- | --- |
| editorialLastModifiedDateTime | Yes | Sorts by each document’s editorialLastModifiedDateTime value. For this sort, desc means “most recent first” and asc means “least recent first”. |
| editorial | No | Sorts the CDS documents “editorially”; see the “Editorial Sort” section above. |
| publishDateTime | Yes | Sorts by each document’s publishDateTime value. For this sort, desc means “most recent first” and asc means “least recent first”. |
| showDates | Yes | Sorts by each document’s most recent entry in the showDates array. For this sort, desc means “most recent first” and asc means “least recent first”. |
| seasonNumber | Yes | If a document has a seasonNumber field, sort by this field in the chosen direction. For this sort, asc means “oldest first” and desc means “newest first.” (This sort is most useful when querying for podcast-episode docs.) |
| episodeNumber | Yes | If a document has an episodeNumber field, sort by this field in the chosen direction. For this sort, asc means “oldest first” and desc means “newest first.” (This sort is most useful when querying for podcast-episode docs.) |



### More on CDS sorting behavior



Here is part of a CDS query that demonstrates the default CDS sorting behavior:



```plaintext
...sort=seasonNumber:asc,episodeNumber:asc
```



The results of this query will look like this:



| seasonNumber | episodeNumber |
| --- | --- |
| 1 | 1 |
| 1 | 2 |
| 1 | 3 |
| 1 | (Missing episodeNumber) |
| … | … |
| 2 | 1 |
| 2 | 2 |
| 2 | 3 |
| 2 | (Missing episodeNumber) |
| … | … |
| (Missing seasonNumber) | (Missing episodeNumber either) |



As we see, CDS has ordered the list of matching documents based on the parameters provided – ie. first by `seasonNumber` (“ascending”, or smallest → largest), then by `episodeNumber` (also “ascending”).



***IMPORTANT NOTE***



The order in which the `sort` query params are specified in the query URL *absolutely matters*. CDS will read these query parameters in order. If we were to invert the order of the fields we were sorting on – ie. `...sort=episodeNumber:asc,seasonNumber:asc...` – our results would look like this instead:



| seasonNumber | episodeNumber |
| --- | --- |
| 1 | 1 |
| 2 | 1 |
| 1 | 2 |
| 2 | 2 |
| 1 | 3 |
| 2 | 3 |
| (Missing seasonNumber) | (Missing episodeNumber) |



You can think of this as CDS saying: “`episodeNumber` is the most important field to sort on (ascending) – and if two episodes have the same `episodeNumber`, *only then* will I sort by `seasonNumber` (ascending).”



***IMPORTANT NOTE***



The effects of the optional `:first` and `:last` params (detailed [below](#optional-first-and-last-params)) are independent of sort direction – ie. docs with missing sort fields will show up where you specify *regardless of whether you are sorting in ascending or descending order.*



Sometimes a client may want to alter this default behavior. This is where the optional `:first` and `:last` param comes in.



### Optional :first and :last params



These are both additional, optional sort parameters that will explicitly tell CDS how to handle sorting of documents that do not contain the fields being sorted on.



The `:first` and `:last` param offers CDS clients a way to specify if they want documents missing some or all fields being sorted on at the beginning or end of the list of results – or of a group of results (if multiple fields are being sorted on).



### Example queries :first and :last param



#### Base behavior example: sorting on only seasonNumber with NO :first and :last



Here is an example query where the results are being sorted only by `seasonNumber` (ascending):



```plaintext
...sort=seasonNumber:asc
```



The resulting list of CDS docs will look like this:



| seasonNumber | episodeNumber |
| --- | --- |
| 1 | (Missing episodeNumber) |
| 1 | 1 |
| 1 | 2 |
| … | … |
| 2 | 1 |
| 2 | 2 |
| … | … |
| (Missing seasonNumber) | (Missing episodeNumber) |



#### And now WITH :first and :last specified



```plaintext
...sort=seasonNumber:asc:first
```



The resulting list of CDS docs will look like this:



| seasonNumber | episodeNumber |
| --- | --- |
| (Missing seasonNumber) | 1 |
| 1 | 1 |
| 1 | 2 |
| … | … |
| 2 | 1 |
| 2 | 2 |
| … | … |



#### :first and :last when sorting on multiple fields



These two optional params allow us to control the ‘What to do if a field is missing on a doc’ behavior *individually for each field being sorted on*. Note the difference in these two queries and their resulting CDS results:



```plaintext
...sort=seasonNumber:asc:first,episodeNumber:asc:first
```



| seasonNumber | episodeNumber |
| --- | --- |
| (Missing seasonNumber) | (Missing episodeNumber) |
| 1 | (Missing episodeNumber) |
| 1 | 1 |
| 1 | 2 |
| 2 | (Missing episodeNumber) |
| 2 | 1 |
| 2 | 2 |



```plaintext
...sort=seasonNumber:asc:first,episodeNumber:asc:last
```



| seasonNumber | episodeNumber |
| --- | --- |
| (Missing seasonNumber) | (Missing episodeNumber) |
| 1 | 1 |
| 1 | 2 |
| 1 | (Missing episodeNumber) |
| 2 | 1 |
| 2 | 2 |
| 2 | (Missing episodeNumber) |



#### :first and :last when sorting on multiple fields – “descending” order



```plaintext
...sort=seasonNumber:desc:first,episodeNumber:desc:first
```



The resulting list of CDS docs will look like this:



| seasonNumber | episodeNumber |
| --- | --- |
| (Missing seasonNumber) | (Missing episodeNumber) |
| 2 | (Missing episodeNumber) |
| 2 | 2 |
| 2 | 1 |
| 1 | (Missing episodeNumber) |
| 1 | 2 |
| 1 | 1 |



#### Different direction and missing values for each field



```plaintext
...sort=seasonNumber:asc:first,episodeNumber:desc:last
```



The resulting list of CDS docs will look like this:



| seasonNumber | episodeNumber |
| --- | --- |
| (Missing seasonNumber) | (Missing episodeNumber) |
| 1 | 2 |
| 1 | 1 |
| 1 | (Missing episodeNumber) |
| 2 | 2 |
| 2 | 1 |
| 2 | (Missing episodeNumber) |

---

## Core Concepts: Links

> Source: https://npr.github.io/content-distribution-service/api-reference/core-concepts/links/

- Link Objects rels
- Link types External links
- Internal links
- Fragments

    [Extension links](#extension-links)

- The “normal” publishing flow
- Publishing with an extension link



# Link Objects



Links in CDS are always represented by a JSON object conforming to [the link schema](https://content.api.npr.org/v1/schemas/link). The `link` schema defines the following:



| Name | Type | Required? | Explanation |
| --- | --- | --- | --- |
| embed | object | No | The embed object is only present when CDS is returning a document with transcluded attributes. The embed object should never be supplied by publishers; if present, it will be stripped. |
| href | string | Yes | The string URL of the linked file itself |
| rels | string array | No | A set of strings describing the relationship between the current document and the linked document |
| type | string | No | The expected RFC6838 compliant media type of the linked file (ex: audio/wav) |



Note that links in CDS can conform to *more* than just this schema! For example, an audio enclosure link could additionally specify a `fileSize` attribute.



## rels



In CDS, the `rels` array is used to describe the relationship between the current document containing the link and the document linked (in this context, “document” doesn’t have to mean CDS document; the linked document could be from anywhere).



In almost every case, the `rels` available to place on a link are restricted down to a small set of values. Check the documentation for the profile you’re implementing to determine which `rels` can be used and what they mean. In general, all `rels` must be compliant with the rules for link relations found in [RFC8288](https://datatracker.ietf.org/doc/html/rfc8288#section-3.3).



## Link types



There are three types of links in CDS documents: *internal*, *external*, and *fragments*.



### External links



External links designate a link to a resource that is hosted externally to CDS itself. Some examples would be:



- links to organization data
- links to media hosted on a CDN
- links to the NPR.org website



All external links in CDS should be represented as a full URL.



### Internal links



Internal links designate a link to a document hosted by CDS. Some examples are:



- links to other CDS documents (/v1/documents/1111)
- links to CDS profiles (/v1/profiles/text)
- links to CDS schemas (/v1/schemas/link)



All internal links in CDS can be represented as either a full URL containing the CDS domain, or as relative links (path-only). CDS will interpret all relative links as relative to itself.



### Fragments



Link fragments specify a link to a piece of the *current document*. While URL syntax allows for a fragment appended to the end of a URL (e.g. `https://npr.org/#home`), CDS does not currently support this, and will only evaluate fragments given alone.



A fragment is commonly used to link to assets embedded within the current document. Consider the following:



```json
{
    "id": "1111",
    "assets": {
        "2222": {
            "id": "2222"
        }
    },

    "layout": [
        {
            "href": "#/assets/2222"
        }
    ]
}
```



In the above example, `#/assets/2222` is a fragment used to link to the `2222` asset embedded in the `assets` object.



CDS assets link fragments should be in JSON Pointer syntax, as defined by [RFC6901](https://datatracker.ietf.org/doc/html/rfc6901). All fragments in CDS are interpreted as being relative to *the document that contains them*.



# Extension links



“Extension links” are a way of linking a CDS document to another CDS document that produces notifications for the linking document whenever the linked document is modified.



To explain further, let’s look at the “normal” CDS document publishing process:



## The “normal” publishing flow



In “normal” CDS documents, a link on a document does not affect downstream notifications. That’s to say: on publish, one doc produces one notification (as long as it’s changed; documents that haven’t changed produce no notifications). Even though that document may be linked to by other CDS documents (and vice versa), this has no affect on notifications; it’s the *client’s* responsibility to determine how its data should change based on the linkages it knows about.



An example of this is diagrammed below:





In the above example, notifications are only sent for Document B. Because Document B has “no knowledge” of Document A (or any other document linking to it), downstream clients won’t cache kill for Document A. This can be a problem for documents like transcripts.



Story documents can link to transcript documents via the `transcriptLink` attribute on [the audio asset profile](https://npr.github.io/content-distribution-service/api-reference/profiles/audio). When rendering these pages, the transcript may be included in the story content itself. However, if the transcript is updated, a notification is sent *for the transcript document only*. Downstream clients won’t update their caches for the story page, and old content is served.



## Publishing with an extension link



An extension link is an internal document link on a CDS document with the `extension` rel:



```json
"link": {
  "href": "/v1/documents/1111",
  "rels": [
    "extension"
  ]
}
```



When CDS receives an update to a document, it will send notifications for it *and any document containing an extension link to it*. This is diagrammed below:





In the above example, a notification is sent for *both* Documents A and B, because A contains an extension link to B. This happens even though Document A has not changed.

---

## Core Concepts: Collections

> Source: https://npr.github.io/content-distribution-service/api-reference/core-concepts/collections/

- Collections Collection links Unordered collection links
- Ordered collection links

  [Querying for a collection](#querying-for-a-collection)

- editorial sort
- A note on the idea of a primary collection



# Collections



**What is a “collection” in CDS?**



A collection is a set of documents that are related to (linked to or from) a single CDS document via a specific set of relationships. The relationships themselves are described later in this document, but the relationship is always a one-to-many relationship from the “parent” document to the “collection” documents.





In CDS, **any document can be used as a collection**. This means topics, tags, series, etc. are collection documents; so are stories, podcast episodes, and categories. For any CDS document, you can ask “what documents are part of this document’s collection?”



## Collection links



A document is linked to a collection in one of two ways:



- Unordered - When a document contains a link to its collection document, it’s considered an “unordered” link.
- Ordered - When a collection document contains a link to its “child” document, it’s considered an “ordered” link.



These types of linkages will be described in further detail below.





It’s important to remember that a document can be linked to a collection using *both* ordered and unordered links!



### Unordered collection links



As stated above, an **unordered** collection link exists on the **child** document and points to the **collection** document. In practice, this is represented by a link object in the child document’s `collections` array, defined by [the publishable profile](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable):



```js
{
    "id": "12345",
    "title": "Sleeping patterns of the Norwegian Blue parrot",
    ...

    "collections": [
        {
            "href": "/v1/documents/6789",
            "rels": [
                "topic"
            ]
        },
        ...

    ]
}
```



In the above example, document `12345` contains an **unordered** link to document `6789`; `12345` is an unordered document in the `6789` collection.



When retrieving a collection, unordered documents can be sorted in any way the client feels is most appropriate.



### Ordered collection links



An **ordered** collection link exists on the **collection** document and points to the **child** document. These links can also be referred to as “prioritized” or “featured” content; this is because these links are usually the result of conscious and deliberate selection (although this is not always the case).



In practice, an ordered link is represented by a link object in the collection document’s `items` array, defined in [the aggregation profile](https://npr.github.io/content-distribution-service/api-reference/profiles/aggregation):



```js
{
    "id": "6789",
    "title": "Animals",
    ...

    "items": [
        {
            "href": "/v1/documents/12345"
        },
        ...

    ]
}
```



In the above example, document `6789` contains an ordered link to document `12345`; `12345` is an ordered document in the `6789` collection.



Documents containing ordered links must have the `items` array; in order to have the `items` array, they must implement the [aggregation profile](https://npr.github.io/content-distribution-service/api-reference/profiles/aggregation) and list it in their `profiles` list. These collection documents can also be called “aggregations”. While *any* document can be a collection document, only documents with the `aggregation` profile can have ordered collection links.



When retrieving a collection using the `editorial` sort mode, ordered collection documents will appear first, in the order that they appear in the `items` array. When using other sort modes, these documents will be sorted along with the unordered documents.



Note that there can be a maximum of `100` links within the `items` array.



## Querying for a collection



When querying for documents, the `collectionIds` parameter can be used to filter down to documents belonging to a collection:



```plaintext
https://content.api.npr.org/v1/documents?collectionIds=6789
```



The above query will return only documents that belong to the `6789` collection, **regardless of if they are ordered or unordered**.



The `collectionIds` parameter functions like any other CDS query parameter; as such, all the following are valid:



- collectionIds=(ID)
- collectionIds=(ID),(ID)
- collectionIds=(ID)&collectionIds=(ID)



### editorial sort



Editorial sorting is a method of sorting the results of a CDS query that places **ordered content before unordered content**. When querying for a collection, ordered content will be returned first in the order it appears in the `items` array, followed by all unordered content sorted by `publishDateTime`. If a document is linked both as an unordered and ordered document, then its ordered placement takes priority; it will show up once and only once, in the “ordered section”.



Editorial sort can only be used with a single `collectionIds` parameter defining one collection ID. You cannot combine collections and sort by editorial sort.



Editorial sort is requested with the query parameter `sort=editorial`.



## A note on the idea of a primary collection



**This is also explained in the [publishable profile](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable) documentation**.



CDS does not currently offer a way to mark a collection as the primary collection in the `rels` array. Rather, we rest on a convention that the `0th` item in the array for `collections` is *in fact the primary collection*.



This is not a convention that is baked in our API, but rather one that `npr.org` upholds.



The convention also applies more specifically to collections marked with a `topic` rel or any other type of rel. For example, in this collections array below:



```json
"collections": [
{
  "href": "/v1/documents/1182407811",
  "rels": [
    "series"
  ]
},
{
   "href": "/v1/documents/12345",
  "rels": [
    "topic"
  ]
}
]
```



The primary `topic` would be the `12345` document, as that is the first collection link listed that has a `topic` in the `rels` array.

---

## Document Endpoints

> Source: https://npr.github.io/content-distribution-service/api-reference/endpoints/document/

- GET Document Query Params Transclude
- Transclude Fields
- Sample Transcluded Responses

  [Response Codes](#response-codes)   [GET Query Documents](#get-query-documents)

- Query Params
- Response Codes

  [PUT Update Document](#put-update-document)

- Response Codes

  [DELETE document](#delete-document)

- Response Codes



# GET Document



Get a single CDS document by ID



```bash
GET /v1/documents/{documentId}
```



## Requires Auth?



Yes. See the [Getting Started](https://npr.github.io/content-distribution-service/getting-started#authorization--permissions) page for more details.



## Query Params



### Transclude



The only valid query param for this endpoint is `transclude`. Using this query param will return the requested CDS document, populated (‘transcluded’) with serialized associated data, in an additional `embed` field on the respective nested resource.



### Transclude Fields



**Please Read**: As of February 2024, we are experiencing problems with the `transclude` parameter when used with `bylines` and `transcript`. Read more below, but do know that we are looking into improving this feature soon:



- bylines: This will only work for text-only bylines. That means that the transclude will not pull in a biography document. To get a biography document you need to follow the href sourced in a bylineDocuments array. See the reference-byline documentation for more information.
- transcript: This unfortunately is not working as expected. As mentioned we are working to resolve this. In the meantime, see this guide on fetching transcript data



The following are perhaps the most common and/or useful options:



| Value | Description | Example Usage |
| --- | --- | --- |
| collections | The CDS collection(s) to which the document belongs | https://content.api.npr.org/v1/documents/nx-s1-5453317?transclude=collections |
| bylines | Information about individuals mentioned in the byline of a story | https://content.api.npr.org/v1/documents/nx-s1-5453317?transclude=bylines |
| layout | The display layout of a story | https://content.api.npr.org/v1/documents/nx-s1-5453317?transclude=layout |
| transcript | The textual transcript associated with this story | https://content.api.npr.org/v1/documents/nx-s1-5453317?transclude=transcript |
| items | The items contained in an aggregation.(For instance, the individual story items in a given program-episode document) | https://content.api.npr.org/v1/documents/nx-s1-5453317?transclude=items |



### Sample Transcluded Responses



Click to expand.

  `collections`

{
    "resources": [
        {
            ...
            "collections": [
                {
                    "href": "/v1/documents/someProgramCollection",
                    "rels": [
                        "program"
                    ],
                    "embed": {
                        "meta": {
                            "assetInternalLinkDocuments": [],
                            "documentLastModifiedDateTime": "2022-05-06T12:56:24.150Z",
                            "extensionLinks": []
                        },
                        "id": "someProgramCollection",
                        "title": "Some Program",
                        "profiles": [
                            {
                                "href": "/v1/profiles/program",
                                "rels": [
                                    "type"
                                ]
                            },
                            ...
                        ],
                        "owners": [
                            {
                                "href": "https://some-url.org/v4/services/someServiceId"
                            }
                        ],
                        "brandings": [
                            {
                                "href": "https://some-url.org/v4/services/someServiceId"
                            }
                        ],
                        "publishDateTime": "2012-01-18T06:00:00-05:00",
                        "authorizedOrgServiceIds": [
                            "someServiceId"
                        ],
                        "editorialLastModifiedDateTime": "2021-12-21T16:29:36-05:00",
                        "images": [],
                        "layout": [],
                        "nprDisplayType": "ProgramMagazine",
                        "nprWebsitePath": "/programs/some-program/",
                        "robotsNoIndex": false,
                        "shortTeaser": "Some Program takes listeners around the country and the world every weekday.",
                        "teaser": "*Some Program* takes listeners around the country and the world with multi-faceted stories and commentaries every weekday. Hosts Some First Host, Some Second Host and Some Third Host bring you the latest breaking news and features to prepare you for the day.",
                        "webPages": [
                            {
                                "href": "https://some-url.org/programs/some-program/",
                                "rels": [
                                    "canonical"
                                ]
                            }
                        ],
                        ...
                    }
                },
                ...
            ]
            ...
        }
    ]
}


  `bylines`

{
    "resources": [
        {
            ...
            "bylines": [
                {
                    "href": "#/assets/12345",
                    "embed": {
                        "id": "12345",
                        "name": "Some Displayable Name",
                        "profiles": [
                            {
                                "href": "/v1/profiles/byline",
                                "rels": [
                                    "type"
                                ]
                            },
                            {
                                "href": "/v1/profiles/document"
                            }
                        ]
                    }
                },
                {
                    "href": "#/assets/678901",
                    "embed": {
                        "id": "678901",
                        "name": "Some Other Displayable Name",
                        "profiles": [
                            {
                                "href": "/v1/profiles/byline",
                                "rels": [
                                    "type"
                                ]
                            },
                            {
                                "href": "/v1/profiles/document"
                            }
                        ]
                    }
                }
            ],
            ...
        }
    ]
}


  `layout`

{
    "resources": [
        {
            ...
            "layout": [
                {
                    "href": "#/assets/12345678-1000",
                    "embed": {
                        "id": "12345678-1000",
                        "profiles": [
                            {
                                "href": "/v1/profiles/text",
                                "rels": [
                                    "type"
                                ]
                            },
                            {
                                "href": "/v1/profiles/document"
                            }
                        ],
                        "text": "*Some text from the document*"
                    }
                }
            ]
            ...
        }
    ]
}


  `items`

{
    "resources": [
        {
            ...
            "items": [
                {
                    "href": "/v1/documents/1234567890",
                    "embed": {
                        "meta": {
                            "assetInternalLinkDocuments": [],
                            "documentLastModifiedDateTime": "2022-04-16T19:55:15.377Z",
                            "extensionLinks": [
                                {
                                    "href": "/v1/documents/1234567890-transcript"
                                }
                            ]
                        },
                        "id": "1234567890",
                        "title": "News brief: Some news happened",
                        "profiles": [
                            ...
                        ],
                        "owners": [
                            {
                                "href": "https://some-url.org/v4/services/some-owner-id"
                            }
                        ],
                        "brandings": [
                            {
                                "href": "https://some-url.org/v4/services/some-owner-id"
                            }
                        ],
                        "publishDateTime": "2022-04-15T05:16:00-04:00",
                        "collections": [
                            ...
                        ],
                        "audio": [
                            {
                                "href": "#/assets/1234567890",
                                "rels": [
                                    "headline",
                                    "primary"
                                ]
                            }
                        ],
                        "authorizedOrgServiceIds": [
                            "someOrgId"
                        ],
                        "bylines": [
                            {
                                "href": "#/assets/someReporterId"
                            },
                            {
                                "href": "#/assets/someReporterId"
                            }
                        ],
                        "editorialLastModifiedDateTime": "2022-04-15T08:14:47-04:00",
                        "layout": [],
                        "nprDisplayType": "NewsStory",
                        "nprWebsitePath": "/2022/04/15/1234567890/some-story-url",
                        "robotsNoIndex": false,
                        "teaser": "We had some NEWS! happen.",
                        "webPages": [
                            {
                                "href": "https://www.npr.org/2022/04/15/1234567890/news-story-item",
                                "rels": [
                                    "canonical"
                                ]
                            }
                        ]
                    }
                },
                ...
            ]
            ...
        }
    ]
}


## Response Codes



| Response Code | Meaning |
| --- | --- |
| 200 | Successful retrieval of a document |



```json
{
    "resources": [
        {
            "id": "12345",
            "profiles": [
                {
                    "href": "/v1/profiles/document"
                },
                {
                    "href": "/v1/profiles/story",
                    "rels": ["type"]
                }
            ],
            "authorizedOrgServiceIds": ["s1", "s350", "s999"],
            "meta": {
                "cdsSecretCode": "40723097957p345234532"
            }
        }
    ]
}
```



| 400 | Bad request |
| --- | --- |



```json
{
    "meta": {
        "messages": ["badQueryParam is an unexpected query parameter"]
    }
}
```



| 404 | Document not found |
| --- | --- |



# GET Query Documents

 Query CDS for documents matching provided query parameters



```bash
GET /v1/documents
```



## Requires Auth?



Yes. See the [Getting Started](https://npr.github.io/content-distribution-service/getting-started#authorization--permissions) page for more details.



## Query Params



Please see the thorough writeup on query params for this endpoint [here](https://npr.github.io/content-distribution-service/api-reference/core-concepts/querying/index.html).



This endpoint also accepts the `transclude` query param, the documentation for which can be found [here](https://npr.github.io/content-distribution-service/api-reference/endpoints/document/#get-document).



## Response Codes



| Response Code | Meaning |
| --- | --- |
| 200 | Successful retrieval of matching documents(NOTE: This endpoint will also return a 200 if no matching documents are found; the response will simply contain an empty resources array.) |



```json
{
    "resources": [
        {
            "id": "12345",
            "profiles": [
                {
                    "href": "/v1/profiles/document"
                },
                {
                    "href": "/v1/profiles/story",
                    "rels": ["type"]
                }
            ],
            "authorizedOrgServiceIds": ["s1", "s350", "s999"],
            "meta": {
                "cdsSecretCode": "40723097957p345234532"
            }
        }
    ]
}
```



| 400 | Bad request |
| --- | --- |



```json
{
    "meta": {
        "messages": ["2022-01-01...2022-12-311 are invalid showDates"]
    }
}
```



# PUT Update Document



Update an existing CDS document, or create a new CDS doc.



```bash
PUT /v1/documents/{documentId}
```



## Requires Auth?



Yes. See the [Getting Started](https://npr.github.io/content-distribution-service/getting-started#authorization--permissions) page for more details.



## Response Codes



| Response Code | Meaning |
| --- | --- |
| 200 | Successful update of a document |
| 201 | Successful creation of a document |



```json
{
    "resources": [
        {
            "id": "12345",
            "profiles": [
                {
                    "href": "/v1/profiles/document"
                },
                {
                    "href": "/v1/profiles/story",
                    "rels": ["type"]
                }
            ],
            "authorizedOrgServiceIds": ["s1", "s350", "s999"],
            "meta": {
                "cdsSecretCode": "40723097957p345234532"
            }
        }
    ]
}
```



| 400 | Bad request |
| --- | --- |



```json
{
    "meta": {
        "messages": [
            "The value {...} failed to validate for the keyword \"required\".\nError: must have required property 'showDate'.\nData location: "
        ]
    }
}
```



# DELETE document



Delete a single CDS document by ID



```bash
DELETE /v1/documents/{documentId}
```



## Requires Auth?



Yes. See the [Getting Started](https://npr.github.io/content-distribution-service/getting-started#authorization--permissions) page for more details.



## Response Codes



| Response Code | Meaning |
| --- | --- |
| 204 | Successful deletion of a document |
| 404 | Document not found |

---

## Profile Endpoints

> Source: https://npr.github.io/content-distribution-service/api-reference/endpoints/profile/

- GET profile Requires Auth?
- Response Codes

  [GET All Profiles](#get-all-profiles)

- Requires Auth?
- Response Codes

  [GET Schema](#get-schema)

- Requires Auth?
- Response Codes

  [GET Client Profile](#get-client-profile)

- Requires Authorization Token?
- Responses 200 - Success
- 404 - Profile not found

    [GET Query Client Profiles](#get-query-client-profiles)

- Requires Authorization Token?
- Query Parameters
- Responses 200 - Success
- 400 - Invalid request



# GET profile



Get an individual CDS Profile. The list of valid CDS profiles can be found [here](https://npr.github.io/content-distribution-service/api-reference/profiles/)



```bash
GET /v1/profiles/{profileName}
```



## Requires Auth?



No (open access)



## Response Codes



| Response Code | Meaning |
| --- | --- |
| 200 | A single CDS Schema or Profile in JSON format |



```json
{
    "$schema": "https://json-schema.org/draft/2019-09/schema#",
    "$id": "/v1/profiles/youtube-video",
    "title": "YouTube Video",
    "description": "An asset representing a YouTube video associated with a document. For more information on how to use this to construct a link/embed, see https://developers.google.com/youtube.",

    "type": "object",
    "required": ["videoId"],
    "properties": {
        "headline": {
            "description": "The person, organization, or series associated with this video for attribution purposes",
            "type": "string"
        },
        "subheadline": {
            "description": "The caption used for the embedded video link",
            "type": "string"
        },
        "startTime": {
            "description": "Number of seconds in the video to start playback",
            "type": "integer",
            "minimum": 0
        },
        "videoId": {
            "description": "The ID used to identify this video within YouTube's API.",
            "type": "string",
            "pattern": "^[^ ]+$"
        },
        "embedSize": {
            "description": "The relative size the embedded YouTube player should be displayed at",
            "type": "string",
            "enum": ["small", "medium", "large", "x-large"]
        }
    }
}
```



| 404 | CDS Schema or Profile not found |
| --- | --- |



# GET All Profiles



Get a list of all current CDS profiles. More information can be found [here](https://npr.github.io/content-distribution-service/api-reference/profiles/).



```bash
GET /v1/profiles
```



## Requires Auth?



No (open access)



## Response Codes



| Response Code | Meaning |
| --- | --- |
| 200 | Successfully returned list of CDS profiles in JSON format |



```plaintext
[
    {
        "href": "/v1/profiles/aggregation"
    },
    {
        "href": "/v1/profiles/audio-card"
    },
    {
        "href": "/v1/profiles/audio"
    }
    ...
]
```



# GET Schema



Get an individual CDS JSON Schema



```bash
GET /v1/schemas/{schemaName}
```



## Requires Auth?



No (open access)



## Response Codes



| Response Code | Meaning |
| --- | --- |
| 200 | Successfully returned list of CDS profiles in JSON format |



```json
{
    "$schema": "https://json-schema.org/draft/2019-09/schema#",
    "$id": "/v1/schemas/link",
    "title": "Link",
    "description": "A link to an externally-defined location",

    "type": "object",
    "required": ["href"],
    "properties": {
        "href": {
            "description": "An RFC3987-compliant internationalized URI",
            "type": "string",
            "format": "iri-reference"
        },
        "rels": {
            "description": "An array of RFC8288-compliant link relation types",
            "type": "array",
            "uniqueItems": true,
            "items": {
                "anyOf": [
                    {
                        "type": "string",
                        "format": "uri"
                    },
                    {
                        "type": "string",
                        "pattern": "^[a-z][a-z0-9.-]*$"
                    }
                ]
            }
        },
        "embed": {
            "description": "This attribute will be used to hold pre-fetched content from this link. If this attribute is present, it should be interpreted as the unaltered response from the link specified in the 'href' attribute.",
            "readOnly": true
        }
    }
}
```



| 400 | Bad request |
| --- | --- |



```json
{
    "meta": {
        "messages": ["Failed to load schema: nonExistentSchemaName.json"]
    }
}
```



| 404 | Schema not found |
| --- | --- |



# GET Client Profile



Retrieve a single client profile from CDS by name.



```bash
GET /v1/client-profiles/{profileName}
```



## Requires Authorization Token?



No, it can be queried directly as a GET request. Example [https://content.api.npr.org/v1/client-profiles/](https://content.api.npr.org/v1/client-profiles/)



## Responses



### 200 - Success



On a successful retrieval, a `200` response code will be returned. The body of the response will be the JSON schema respresnting the client profile.



Example:



```plaintext
GET https://content.api.npr.org/v1/client-profiles/example-profile
---
200
{
  "$schema": "https://json-schema.org/draft/2019-09/schema#",
  "$id": "/v1/client-profiles/example-profile",
  "title": "Example Profile",

  "type": "object",
  "required": [
  ...
}
```



### 404 - Profile not found



If the requested client profile does not exist, a `404` status code will be returned with an error response.



```plaintext
GET https://content.api.npr.org/v1/client-profiles/invalid-profile
---
404
{
  "meta": {
    "messages": [
      "Failed to load profile invalid-profile"
    ]
  }
}
```



# GET Query Client Profiles



Retrieve a set of client profiles from CDS



```bash
GET /v1/client-profiles
```



## Requires Authorization Token?



No, it can be queried directly as a GET request. Example [https://content.api.npr.org/v1/client-profiles/](https://content.api.npr.org/v1/client-profiles/)



## Query Parameters



This endpoint supports two query parameters:



| Name | Minumum | Maximum | Default | Description |
| --- | --- | --- | --- | --- |
| limit | 1 | 300 | 20 | How many profiles to return |
| offset | 0 | (2000 - limit) | 0 | Where to begin the return set of profiles |



`limit` and `offset` allow for a simple method of paginating through client profiles when searching for them. Together, these values cannot add up to more than 2000.



## Responses



### 200 - Success



On a successful retrieval, a `200` response code will be returned. The body of the response will be the profiles in a JSON content view.



Example:



```plaintext
GET https://content.api.npr.org/v1/client-profiles?offset=0&limit=20
---
200
{
  "resources": [
    {
      "$schema": "https://json-schema.org/draft/2019-09/schema#",
      "$id": "/v1/client-profiles/example-profile",
      "title": "Example Profile",

      "type": "object",
      "required": [
      ...
    },
    ...
  ]
}
```



### 400 - Invalid request



If one or more of the query parameters given is invalid, a `400` response will be returned with an error explanation.



```plaintext
GET https://content.api.npr.org/v1/client-profiles?limit=all-of-them
---
400
{
  "meta": {
    "messages": [
      "all-of-them is an invalid limit value"
    ]
  }
}
```

---

## Subscription Endpoints

> Source: https://npr.github.io/content-distribution-service/api-reference/endpoints/subscription/

Note:



The functionality described here is intended only for internal NPR users of CDS and is not scoped for Member Stations.



- POST Subscription Confirmation Description
- Response Codes Example Error Response



# POST Subscription Confirmation



Confirm a subscription to CDS document notifications



```plaintext
POST /v1/subscriptions/confirmations
```



## Requires Auth?



Yes. See the [Getting Started](https://npr.github.io/content-distribution-service/getting-started#authorization--permissions) page for more details.



## Description



This endpoint allows a client to confirm their subscription to CDS document notifications. This message requires a JSON-encoded body containing data sent from a CDS subscription confirmation message.



## Response Codes



| Response Code | Meaning |
| --- | --- |
| 200 | The subscription has been confirmed |
| 400 | The data sent was invalid; see the meta.messages attribute in the body for more information |
| 401 | The Authorization token provided in the request was not associated with a recognized CDS client |



### Example Error Response



```json
{
    "meta": {
        "messages": ["Error: Could not parse JSON body"]
    }
}
```

---

## Advanced: Notifications

> Source: https://npr.github.io/content-distribution-service/api-reference/advanced/notifications/

Note:



The functionality described here is intended only for internal NPR users of CDS and is not scoped for Member Stations.



- Notifications Notification Failure & Retries

  [Subscribing to Notifications](#subscribing-to-notifications)

- The Subscription Flow Step 1: Implement a Webhook
- Step 2: Email NPR
- Step 3: CDS sends a confirmation message
- Step 4: Notifications flow as normal!

  [How to unsubscribe](#how-to-unsubscribe)   [The webhook](#the-webhook)

- Subscription Confirmation

  [Processing Notifications](#processing-notifications) [Notification payloads](#notification-payloads)

- Created notification Example

  [Deleted notification](#deleted-notification)

- Example

  [Prior document information](#prior-document-information)

- Prior document URL
- Partial prior document

    [Filters](#filters)

- Profile Filters Prior Document Profiles
- Examples

    [Extension Links](#extension-links)

# Notifications



Every time a document is created, modified, or deleted in CDS, CDS will send one (or more) notifications out to listening clients. Clients can subscribe to these notifications, and take action based on their content.





To get started with CDS notifications, see the links below.



## Notification Failure & Retries



Notifications that are sent to clients can fail - there might be a general network glitch or the client might be down. The CDS will retry sending the request for up to 1 hour with an exponential back off. This means CDS will immediately try once, if that fails, CDS will wait 5 seconds, then steadily increase the wait time between tries up to 5 minutes, then try again up to an hour. If this policy cannot work with your system’s requirements, please talk to [NPR Member Partnership](https://studio.npr.org/s/support-home).



# Subscribing to Notifications



Clients that wish to subscribe to CDS document change notifications should first ensure their application has a **webhook endpoint** that is capable of handling the notification request. This endpoint should:



- Be publicly accessible on the Internet
- Be capable of handling (and responding to) a POST request from CDS



In addition, your client should already have [a CDS Authorization token](https://npr.github.io/content-distribution-service/getting-started#authorization) that will be used for subscribing to notifications. If you don’t already have one, [reach out](https://npr.github.io/content-distribution-service/getting-started#authorization)!



## The Subscription Flow



### Step 1: Implement a Webhook



In order to receive notifications, clients must implement a webhook that is capable of both confirming the subscription to CDS document events, and processing notifications as they come through.



For information on how to implement this webhook for your client, see the [webhook documentation](#the-webhook).



### Step 2: Email NPR



For stations that would like to be subscribed to CDS notifications, email [Member Partnership](https://studio.npr.org/s/support-home). Please provide the following information:



- The URL of the webhook that will receive the notifications
- Any profiles you would like to filter notifications on



Once we receive your request, we’ll get back to you with a time that we can turn on notifications for your client.



### Step 3: CDS sends a confirmation message



When NPR sets up notifications for your client, CDS will send a *confirmation message* to the webhook you’ve provided. That message will be a JSON-encoded message containing a `Type` attribute with the value `SubscriptionConfirmation`:



```json
{
  "Type": "SubscriptionConfirmation",
  ...
}
```



Confirmation messages should be responded to within five minutes.



When your client receives this message, it should forward the body *verbatim* to [the CDS subscription endpoint](https://npr.github.io/content-distribution-service/api-reference/endpoints/subscription/). CDS will respond with a 200, indicating the subscription is confirmed.



For more information on how subscription confirmation message handling, see [the webhook documentation](#the-webhook).



### Step 4: Notifications flow as normal!



Your client will begin to receive POST requests from CDS containing notifications of document creations, deletions, and updates.



## How to unsubscribe



In order to unsubscribe, email [Member Partnership](https://studio.npr.org/s/support-home) with your subscription details.



# The webhook



In order to subscribe to CDS document notifications, clients must implement a **webhook** that can perform the following functions:



- Receive a confirmation message from CDS and forward it onwards
- Receive document create/update/delete notifications and process them



## Subscription Confirmation



When NPR sets up notifications for your client, CDS will send a *confirmation message* to the webhook you’ve provided. That request will be a `POST` request, and the body will be a JSON-encoded message containing a `Type` attribute with the value `SubscriptionConfirmation` along with additional information:



```json
{
  "Type": "SubscriptionConfirmation",
  ...
}
```



**NOTE**: Confirmation messages contain a `Type` attribute (capitalized); all other notifications contain a `type` attribute (all lowercase).



When a client receives this message, it should send a `POST` request to [the CDS subscription endpoint](https://npr.github.io/content-distribution-service/api-reference/endpoints/subscription/). The body of this post request should be *exactly* the body that was received in the confirmation request; no alterations should be made. This endpoint requires [authorization](https://npr.github.io/content-distribution-service/getting-started#authorization).



CDS will respond with a 200, indicating the subscription is confirmed.







# Processing Notifications



Once the subscription is confirmed, CDS will begin sending notifications to the webhook provided. These notifications will all be `POST` requests, and the bodies will all represent document create/update/delete events from CDS. For more information on the notifications themselves, see [the payloads documentation](#notification-payloads).



# Notification payloads



There are three types of notification payloads that can be sent by CDS:



- Created
- Deleted
- Updated



Every notification will **always** contain the following attributes:



| Attribute | Type | Description |
| --- | --- | --- |
| type | String | The type of this notification. This will always be document.created, document.updated, or document.deleted |
| documentId | String | The ID of the document affected |
| documentUrl | URL | A link to retrieve this document (note: in the case of deleted documents, this link may return a 404) |



```json
{
    "type": "document.created",
    "documentId": 12345,
    "documentUrl": "https://content.api.npr.org/v1/documents/12345"
}
```



Based on the type of notification, there *may* be additional information in the notification. See each notification page or the below links for more details.



- Prior document information



## Created notification



When a document is *newly* published, a “created” notification is sent for it. This notification will not have any “prior document” information.



A “created” notification will have the following attributes:



| Attribute | Type | Guaranteed present? | Description |
| --- | --- | --- | --- |
| type | string | Yes | The type of the event; for a “created” event, this will be document.created |
| documentId | string | Yes | The ID of the newly-created document |
| documentUrl | string | Yes | The absolute URL of the newly-created document |



### Example



```json
{
    "type": "document.created",
    "documentId": "1002",
    "documentUrl": "https://content.api.npr.org/v1/documents/1002"
}
```



## Deleted notification



When an existing document is deleted, a “deleted” notification is sent. This notification will have “prior document” information contained in it.



A “deleted” notification will have the following attributes:



| Attribute | Type | Description |
| --- | --- | --- |
| type | string | The type of the event; for a “deleted” event, this will be document.deleted |
| documentId | string | The ID of the deleted document |
| documentUrl | string | The absolute URL of the deleted document (note that this URL will likely return a 404 at this point) |
| priorDocumentUrl | string | A URL at which the full prior document can be retrieved. This URL is valid for 24 hours after the deletion itself. |
| partialPriorDocument | object | A trimmed-down version of the prior document; for more info, see the prior document page |



### Example



```json
{
    "type": "document.deleted",
    "documentId": "1000",
    "documentUrl": "https://content.api.npr.org/v1/documents/1000",
    "priorDocumentUrl": "https://cds-prior-documents.npr.org/000000-0000-0000-000000",
    "partialPriorDocument": {
        "collections": [
            {
                "href": "/v1/documents/1234",
                "rels": ["podcast-channel"]
            },
            {
                "href": "/v1/documents/5678",
                "rels": ["topic"]
            }
        ],
        "nprWebsitePath": "/1000/2022/02/25/hes-back-superman-returns-to-earth"
    }
}
```



## Prior document information



When a document is deleted or updated, the notification sent will have “prior document” information; essentially, this is information representing the document prior to deletion or modification. This is represented in two ways: the `partialPriorDocument` object, and the `priorDocumentUrl` link.



### Prior document URL



The `priorDocumentUrl` is a URL at which the prior document is available for retrieval in its entirety by clients. This URL is valid for 24 hours, after which the prior document will no longer be available.



Note that you only need to do a simple “GET” with no authentication to see the prior document. S3 will reject the request if you try and use the same authentication you do for the CDS.



```json
"priorDocumentUrl": "https://cds-prior-document-host.npr.org/00000-0000-0000-000000"
```



### Partial prior document



The `partialPriorDocument` object contains a small portion of the prior document. This partial document allows clients to take action without necessarily pulling the entire document from the `priorDocumentUrl`.



The following attributes will be place into the `partialPriorDocument` object, but only if they were *originally present on the prior document*. So, if a prior document had no `nprWebsitePath`, for example, that attribute would not be present in the `partialPriorDocument` object.



| Attribute | Profile |
| --- | --- |
| collections | publishable profile |
| nprWebsitePath | renderable profile |



```json
"partialPriorDocument": {
  "collections": [
    {
      "href": "/v1/documents/12345",
      "rels": [
        "topic"
      ]
    },
    {
      "href": "/v1/documents/67890",
      "rels": [
        "podcast-channel"
      ]
    }
  ],
  "nprWebsitePath": "/2022/05/27/12345670/firefly-class-craft-deemed-unsafe"
}
```



# Filters



When subscribing to CDS notifications, clients may choose to receive only a *subset* of notifications sent by CDS. This subset is controlled by filters, chosen when a client [initially subscribes to CDS](https://npr.github.io/content-distribution-service/api-reference/advanced/notifications/#subscribing-to-notifications).



Currently, notifications can only be filtered by [profile](https://npr.github.io/content-distribution-service/api-reference/profiles).



## Profile Filters



When a client provides a set of profiles to filter by, they are indicating that they wish to *only* receive notifications affecting *those particular profiles*. All other notifications will **not** be sent to the client.



For example, say the client wishes to filter by the profiles [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio), [podcast-episode](https://npr.github.io/content-distribution-service/api-reference/profiles/podcast-episode), and [listenable](https://npr.github.io/content-distribution-service/api-reference/profiles/listenable). Any notification concerning a document containing *any* of those profiles at the top level will be sent to the client; all others will be filtered out.



### Prior Document Profiles



Filters apply to the profiles of both the *current* document and the *prior* document. In practice, this means notifications will be sent for all the following cases:



- If a document is created with the client’s configured profiles
- If a document is updated and it has a configured profile
- If a document is updated and a configured profile is added
- If a document is updated and a configured profile is removed
- If a document is deleted and it had a configured profile



### Examples



Let’s say a client is filtering by [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio), [podcast-episode](https://npr.github.io/content-distribution-service/api-reference/profiles/podcast-episode), and [listenable](https://npr.github.io/content-distribution-service/api-reference/profiles/listenable).



- A document is created with the following profiles: document
- has-audio
- story

  A notification **WILL** be sent to the client, because it is filtering for [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio).

- A document is created with the following profiles: document
- story
- has-images

  A notification **WILL NOT** be sent to the client, because it has none of the configured profiles.

- A document is with the following profiles is deleted: document
- has-audio
- story

  A notification **WILL** be sent to the client, because it is filtering for [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio).

- A document with the following profiles is deleted: document
- story
- has-images

  A notification **WILL NOT** be sent to the client, because it has none of the configured profiles.

- A document with the following profiles is updated; its profiles are unchanged: document
- has-audio
- story

  A notification **WILL** be sent to the client, because it is filtering for [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio).

- A document with the following profiles is updated: document
- has-audio
- story

  The [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio) profile is **removed**. A notification **WILL** be sent to the client, because it is filtering for [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio).

- A document with the following profiles is updated: document
- story

  The [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio) profile is **added**. A notification **WILL** be sent to the client, because it is filtering for [has-audio](https://npr.github.io/content-distribution-service/api-reference/profiles/has-audio).

# Extension Links



The *majority* of creation, deletion, and update events in CDS will result in exactly one notification being sent for the event. The exception is for extension links; when two documents are linked via an extension link, additional notifications will be sent for linked documents (unless filtered by the client’s [profile filters](https://npr.github.io/content-distribution-service/api-reference/advanced/notifications#filters)).



For more information, see the page on [Extension Links](https://npr.github.io/content-distribution-service/api-reference/core-concepts/links#extension-links).

---

## Advanced: Client Profiles

> Source: https://npr.github.io/content-distribution-service/api-reference/advanced/client-profiles/

- Client Profiles Creating your profiles
- Accessing Client Profiles
- A note for publishers Excluding content from a client Example Exclusion

    [Using client profiles](#using-client-profiles)

# Client Profiles



A “client profile” is a profile that is created, maintained, and managed by a single CDS retrieval client; these are different from the [“common profiles”](https://npr.github.io/content-distribution-service/api-reference/profiles/#individual-profile-documentation) that are built into CDS.



A client profile is used by a retrieval client to mark and retrieve a subset of CDS documents that meet the client’s determined specifications. These allow clients to specify requirements on documents in addition to those defined by CDS’ built-in common profiles. This also gives publishers insight into what requirements are needed by a client in order to utilize a document.



A good example is the client profile used by NPR One applications. Publishers who are expecting their content to appear in NPR One can look at that client profile and make sure they have the required document structure. Furthermore, a publisher can specifically exclude a client profile from their document; this is useful if a document has everything that NPR One requires, but editorially it was decided that this isn’t a good story to appear in NPR One.



## Creating your profiles



The NPR Team is happy to help you create your client profiles! So don’t worry if you are not a JSON schema expert.



That said, client profiles are JSON schema documents just like [the common profiles](https://npr.github.io/content-distribution-service/api-reference/profiles/) and they are subject to the following restrictions:



- The profile ID MUST be of the form “/v1/client-profiles/"; the last part of the profile (the "name") must be unique within the set of all CDS profiles, including common profiles.
- Client profiles MUST NOT reference other client profiles.



Once the client profile is ready to go, the NPR Team will review it. Once approved, it will be added to the CDS where it will be available for querying and validation.



## Accessing Client Profiles



Client profiles are stored in CDS, and will be accessible via the [get client profile](https://npr.github.io/content-distribution-service/api-reference/endpoints/profile#get-query-client-profiles) endpoint.



## A note for publishers



Publishers do not need to (and in fact can not!) add client profiles to their documents on publish as they do common profiles.



Instead the CDS will compare the document when it is published with all the client profiles and add them to a `meta` section of the document automatically. New client profiles added after the document was published will also be applied if there is a match.



### Excluding content from a client



If a publisher wants to keep content out of a specific client, they can use the attribute `profileExclusions` described in the [common publishable profile](https://npr.github.io/content-distribution-service/api-reference/profiles/publishable). This optional attribute will be an array of client profiles that the publisher does not wish to be validated against. This prevents the client profile from being added to the document’s `meta` section and if the client searches using that profile it will not be returned. It should be noted that any document added to the CDS can be accessed by any client, regardless of exclusions. Profile exclusions allow publishers to keep the client profile off their document, but a client can choose to query for documents without using that client profile.



#### Example Exclusion



```json
"profileExclusions": [
     {
         "href": "/v1/client-profiles/has-transcript"
     }
  ]
```



When a document is validated against client profiles, it will not be validated against profiles listed in the `profileExclusions` array. This way a publisher can have some control of where their content appears.



## Using client profiles



When a client wants to retrieve content based on their client profile, they can use the profile name (the last part of the ID) in the `profileIds` query. This can be combined with common profiles to create more complex queries as needed.



See [filtering under the query documentation](https://npr.github.io/content-distribution-service/api-reference/core-concepts/querying#filtering) for more details.
