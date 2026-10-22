import { MongoClient } from "mongodb";
import { loadEnvFile, getMongoConfig } from "./env.js";
import { migratePointIds } from "./lib/location-point-migration.js";

// Run with writes paused. Default is a dry run; --apply persists IDs.
await loadEnvFile();
const { uri, dbName } = getMongoConfig();
const client = new MongoClient(uri);
const apply = process.argv.includes("--apply");

try {
  await client.connect();
  const db = client.db(dbName);
  const parentPoints = new Map();
  const counts = { locations: 0, contributions: 0 };
  const locations = db.collection("locations");
  for await (const document of locations.find({})) {
    const points = migratePointIds(document.coordinatePoints);
    parentPoints.set(document._id.toString(), points);
    if (
      JSON.stringify(points) === JSON.stringify(document.coordinatePoints ?? [])
    )
      continue;
    counts.locations++;
    if (apply) {
      const result = await locations.updateOne(
        {
          _id: document._id,
          coordinatePoints: document.coordinatePoints ?? { $exists: false },
        },
        { $set: { coordinatePoints: points } },
      );
      if (!result.matchedCount)
        throw new Error(
          "Location changed during migration. Pause writes and rerun.",
        );
    }
  }
  const contributions = db.collection("contributions");
  for await (const document of contributions.find({})) {
    const parent = parentPoints.get(document.locationId?.toString()) ?? [];
    const changes = {};
    const filter = { _id: document._id };
    // Do not invent original submissions or historical base snapshots.
    for (const field of ["payload", "submittedPayload", "basePayload"]) {
      const snapshot = document[field];
      if (!snapshot) continue;
      const points = migratePointIds(snapshot.coordinatePoints, parent);
      if (
        JSON.stringify(points) ===
        JSON.stringify(snapshot.coordinatePoints ?? [])
      )
        continue;
      filter[field] = snapshot;
      changes[field] = { ...snapshot, coordinatePoints: points };
    }
    if (!Object.keys(changes).length) continue;
    counts.contributions++;
    if (apply) {
      const result = await contributions.updateOne(filter, { $set: changes });
      if (!result.matchedCount)
        throw new Error(
          "Contribution changed during migration. Pause writes and rerun.",
        );
    }
  }
  console.log(
    JSON.stringify({ mode: apply ? "applied" : "dry-run", ...counts }),
  );
} finally {
  await client.close();
}
