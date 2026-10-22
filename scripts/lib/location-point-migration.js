/** Migration only. Runtime reads must use the persisted IDs. */
export function migratePointIds(points = [], parentPoints = []) {
  points ??= [];
  const used = new Set(points.map((point) => point.id).filter(Boolean));
  const parentIds = new Set(parentPoints.map((point) => point.id));
  const seen = new Set();
  return points.map((point, index) => {
    let id = typeof point.id === "string" ? point.id.trim() : "";
    if (!id || id.length > 80 || seen.has(id)) {
      // Reuse identity only for an unambiguous unchanged point. Never guess
      // based on kind alone: several entrances/parking points may coexist.
      const candidates = parentPoints.filter(
        (parent) =>
          parent.kind === point.kind &&
          parent.latitude === point.latitude &&
          parent.longitude === point.longitude &&
          parent.label === point.label,
      );
      const parentId = candidates.length === 1 ? candidates[0].id : null;
      if (parentId && !used.has(parentId)) {
        id = parentId;
      } else {
        const base = `migrated-point-${index + 1}`;
        id = base;
        let suffix = 2;
        while (used.has(id) || parentIds.has(id)) id = `${base}-${suffix++}`;
      }
    }
    used.add(id);
    seen.add(id);
    return { ...point, id };
  });
}
