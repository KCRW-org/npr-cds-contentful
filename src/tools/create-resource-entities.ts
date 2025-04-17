import { createResourceProvider, createResourceType } from "./http";
import { npr, story, collection } from "./imports";

const main = async () => {
  const nprResult = await createResourceProvider(npr);
  const [collectionResult] = await Promise.all([
    createResourceType(collection),
  ]);
  const [storyResult] = await Promise.all([createResourceType(story)]);

  console.dir(nprResult, { depth: 5 });
  console.dir(collectionResult, { depth: 5 });
  console.dir(storyResult, { depth: 5 });
};

main();
