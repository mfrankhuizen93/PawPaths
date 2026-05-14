import { MongoClient } from "mongodb";

let clientPromise;

export function getMongoConfig() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? "pawpaths";

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  return { uri, dbName };
}

export async function getDb() {
  const { uri, dbName } = getMongoConfig();

  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(dbName);
}
