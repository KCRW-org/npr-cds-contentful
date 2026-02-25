import { deleteResourceProvider, deleteResourceType } from "./http";
import { npr, story, collection } from "./imports";

const main = async () => {
  const [collectionResourceType] = await Promise.all([
    deleteResourceType(collection),
  ]);
  const [storyResourceType] = await Promise.all([deleteResourceType(story)]);
  const resourceProvider = await deleteResourceProvider();

  console.dir(resourceProvider, { depth: 5 });
  console.dir(collectionResourceType, { depth: 5 });
  console.dir(storyResourceType, { depth: 5 });
};

main();
