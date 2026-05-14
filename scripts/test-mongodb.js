import { MongoClient } from "mongodb";
import { getMongoConfig, loadEnvFile } from "./env.js";

await loadEnvFile();
const { uri, dbName } = getMongoConfig();

const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);
  const ping = await db.command({ ping: 1 });
  const collections = await db.listCollections().toArray();

  console.log("MongoDB connection OK");
  console.log(`Database: ${db.databaseName}`);
  console.log(`Ping: ${ping.ok}`);
  console.log(`Collections: ${collections.length}`);
} finally {
  await client.close();
}
