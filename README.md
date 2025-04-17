# NPR CDS Integration for Contentful

This app provides an integration of the NPR Content Distribution System with the Contentful CMS using the [Native External References](https://www.contentful.com/help/orchestration/native-external-references/) feature. The current implementation is read-only.

## App Structure

This app provides the following features:

* Resource configuration for the external resources
* A configuration panel for setting your CDS access token for each environment the app is installed in
* Lookup and Search event handlers to allow referencing NPR Programs and Stories
* GraphQL query handler to allow direct inclusion of external resource data in GraphQL queries

## Using the App

### Installing the App

You can install the app in a Contentful space using `npm run create-app-definition`. The app renders an "App configuration screen", but no other app UI currently.

Once the app is installed, you should create the required external resource type definitions using `npm run create-resource-entities`. This command will also update existing resource type definitions for the app.

The `npm run build` command will build the app functions and UI scripts, and the `npm run upload` command will upload the app package to your Contentful space.

### Enabling the App

Once the app is installed in your Contentful space, you will want to enable it in a particular environment. You can do this by visiting the Apps -> Custom Apps menu from your Contentful Environment and clicking the Install button. This will require you to set a CDS access token value.

You can integrate NPR Story and Program content into your site by adding Reference fields to your content models. Once the app is enabled in your environment, if you create a new Reference field with the Source set to "Different spaces and external sources", the field configuration will allow you to select `NPR` as a content source and allow selecting the types `Story` and `Collection`.

Once a reference field is in your model you should be able to use the field to select Programs or Stories from the Contentful UI. Due to limitations in the CDS API, you cannot search for content except by entering an exact NPR content ID.

### Querying Referenced NPR Content

The app stores the CDS API path for each referenced entry in the reference fields. When using the Contentful CDA, you will have to use the external API to resolve those URNs into data. When using GraphQL, you can resolve the data in your query.

For example, if you have a Program content type which has an external reference field called `nprProgram` which references an NPR program, you can make a GraphQL query like the following to retrieve CDS data alongside your Program data:

```
query {
  program (id: "...") {
    title
    nprProgram {
      node {
        # Look for Collection references, which are programs
        ... on Node_NPR_Collection {
          id
          urn
          title
          description
          image {
            url
            altText
            scalable
            urlTemplate
          }
          # Retrieve stories from the collection
          items {
            id
            urn
            description
            title
            subtitle
            externalUrl
            audio {
              url
              duration
            }
            image {
              url
              altText
              scalable
              urlTemplate
            }
          }
        }
      }
    }
  }
}
```

Currently, Programs are the only supported collections and the Program data that can be included in queries is the following:

* `id`
* `urn`
* `title`
* `subtitle`
* `description` (`teaser` in CDS)
* `publishDateTime`
* `externalUrl` the canonical web page
   `image`, which attempts to find the primary image in a scalable format, and provides the properties `url`, `altText`, a `scalable` boolean, and a `urlTemplate` for generating image scales if the image is scalable.
* `items` an array of Story objects with the `has-images` profile, `publishDateTime` values in the past, sorted using NPR's `editorial` sort.

All of these properties except for `id` and `urn` are optional for Collections/Programs.

Story content supports all of the same properties except `items`, and additionally optionally provides:

* `audio` which attempts to find the primary audio media for the story, and provides the properties `url` and `duration`.

Referenced NPR Story content can be queried in the same way using the inline fragment `... on Node_NPR_Collection ` to fetch Story nodes. For example you might query a `nprStories` multi-valued reference field like this:

```
query {
  program (id: "...") {
    title
    nprStories {
      items {
        node {
          ... on Node_NPR_Story {
            id
            urn
            description
            title
            subtitle
            externalUrl
            audio {
                url
                duration
            }
            image {
                url
                altText
                scalable
                urlTemplate
            }
          }
        }
      }
    }
  }
}
```


## Notes

* Currently the only supported Collection type is Program
* There is currently no write support, and it's not clear how to implement write support in a generalizable way. It may be left as an exercise to the reader since it will be entirely dependent on content models.
* The CDS Query API does not currently support any sort of full text search, so the reference search bar will only work with pasted NPR content IDs if you know them.
* The Collection search/listing currently includes all programs in alphabetical order by title.
* The Story search/listing currently includes all published stories using the `editorial` sort.
