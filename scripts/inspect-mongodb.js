import { MongoClient } from "mongodb";
import { getMongoConfig, loadEnvFile } from "./env.js";

await loadEnvFile();

const { uri, dbName } = getMongoConfig();
const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);
  const locations = db.collection("locations");
  const sample = await locations.findOne(
    {},
    {
      projection: {
        _id: 0,
        name: 1,
        city: 1,
        country: 1,
        location: 1,
        type: 1,
        characteristics: 1,
        photos: { $slice: 2 },
        relatedUrls: { $slice: 2 },
        reviews: { $slice: 1 },
      },
    },
  );

  console.log(`Database: ${db.databaseName}`);
  console.log(`Locations: ${await locations.countDocuments()}`);
  console.log("Indexes:");

  for (const index of await locations.indexes()) {
    console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
  }

  console.log("Sample location:");
  console.log(JSON.stringify(sample, null, 2));
} finally {
  await client.close();
}
