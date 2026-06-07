import { MongoClient } from "mongodb";
import { getMongoConfig, loadEnvFile } from "./env.js";

const SUBMITTER_ID = "staatsbosbeheer-scraper";
const APPLY = process.argv.includes("--apply");

await loadEnvFile();

const { uri, dbName } = getMongoConfig();
const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);
  const contributions = db.collection("contributions");
  const locations = db.collection("locations");
  const scraperContributions = await contributions
    .find(
      { "submitter.id": SUBMITTER_ID },
      {
        projection: {
          _id: 1,
          status: 1,
          locationName: 1,
          "payload.name": 1,
        },
      },
    )
    .toArray();
  const contributionIds = scraperContributions.map(
    (contribution) => contribution._id,
  );
  const linkedLocations = await locations
    .find(
      { sourceContributionId: { $in: contributionIds } },
      {
        projection: {
          _id: 1,
          name: 1,
          slug: 1,
          status: 1,
          sourceContributionId: 1,
        },
      },
    )
    .toArray();

  console.log(`Database: ${dbName}`);
  console.log(`Scraper contributions: ${scraperContributions.length}`);
  console.log(`Linked locations: ${linkedLocations.length}`);
  for (const location of linkedLocations) {
    console.log(`- ${location.name} (${location.slug})`);
  }

  if (!APPLY) {
    console.log("Dry run only. Add --apply to remove these records.");
  } else {
    const locationResult = await locations.deleteMany({
      sourceContributionId: { $in: contributionIds },
    });
    const contributionResult = await contributions.deleteMany({
      "submitter.id": SUBMITTER_ID,
    });

    console.log(`Locations removed: ${locationResult.deletedCount}`);
    console.log(`Contributions removed: ${contributionResult.deletedCount}`);
  }
} finally {
  await client.close();
}
