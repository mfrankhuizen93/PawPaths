import { MongoClient } from "mongodb";

let clientPromise;
const MONGODB_TIMEOUT_MS = 10_000;

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
    const client = new MongoClient(uri, {
      connectTimeoutMS: MONGODB_TIMEOUT_MS,
      serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS,
      socketTimeoutMS: MONGODB_TIMEOUT_MS,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  const client = await clientPromise;
  return client.db(dbName);
}
