# Walking-area data contract

This document specifies the contract implemented by the shared location types,
normalizers, API projections, and contribution persistence. Product direction
remains in [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md). This is a staged contract;
it does not establish that the target navigation, filters, route UI, or moderation
comparison UI are delivered.

## Area identity and discovery geometry

The MongoDB location `_id` (public `id`) identifies the walking area. Its slug is
a link identifier, not the identity of a point. Existing `latitude`/`longitude`
represent the area for discovery; MongoDB `location` is the derived GeoJSON Point
with coordinates in **[longitude, latitude]** order. Updating a destination must
not move this representative position, and updating the position must not move
destinations. No boundary can be inferred from this point. Polygon/multipolygon
storage remains an open decision; this change introduces no speculative geometry
migration.

## Independently identifiable points

Every stored `coordinatePoints` entry requires a nonempty string `id`, unique
within its parent area and at most 80 characters. The parent location plus point
ID identifies it. Kind, label, array position, and coordinates do not identify it.
Edits and reordering retain the ID; new points receive a fresh client-generated
ID. Repeated kinds are valid, including several entrances or parking locations.
The current form's limit of eight points remains; oversized writes are rejected
rather than silently truncated. Coordinates retain their submitted precision.

### Placement and confirmation precision

Add, edit, and moderation use the same explicit placement interaction. Choose a
point from the map or list (or add one), select a position by map click or address
search, and choose **Confirm position**. The picker emits one named
`{ latitude, longitude }` pair. Unconfirmed placement stays separate from the
editable payload; switching points, canceling placement, or dismissing the map
editor discards only that temporary selection. Submission is blocked while a
placement is active. A failed submission retains the confirmed editable payload.

Newly placed pairs are validated against latitude `[-90, 90]` and longitude
`[-180, 180]`, then rounded to six decimal places before confirmation
(maximum rounding difference: `0.0000005` degrees per axis). Negative zero is
normalized to zero. Confirmation commits exactly that selected pair to the
selected area or stable point ID, never falling back to the area for a missing
point. A deliberate **Set as general location** action stages the point's position
for area confirmation and retains the original point.

Editable normalization, submission sanitization, reviewer saving, approval, and
reload preserve the submitted numeric values without further rounding. Existing
unmoved coordinates can retain more than six decimal places. Confirmation and the
point list show nearby area names and readable address details instead of raw
latitude/longitude. These descriptions come from the existing reverse lookup;
they never change the pinned position or the contributor's names. Lookups are
debounced, shared by exact coordinate pair, cached in memory, and serialized.
Late results from a previous selection are ignored. When geographical data is
unavailable, users can still confirm the pin on the map.

`general` remains a recognized legacy kind, but it does not turn an area position
into an entrance. Only recorded `entrance` and `parking` points with valid
coordinates qualify as navigation destinations in `getLocationDestinations`.
Empty points mean no destinations are recorded. Consumers must not manufacture
destinations from area coordinates, photos, or a route. Wiring destination
selection into existing navigation UI is separate delivery work.

Runtime reads do not synthesize missing IDs. Existing points must be migrated
before deployment of the required-ID write contract (see below).

## Area attributes and unknown information

The optional additive `attributes` object records `offLeash` as `everywhere`,
`partial`, `not-allowed`, or `unknown`; `fenced`, `swimming`, and
`wheelchairAccessible` use `yes`, `no`, or `unknown`. Explicit values take
precedence over legacy evidence. Partial/missing attributes normalize to unknown,
except for known positive legacy characteristics. Legacy `off-leash area` means
some permission (`partial`), never permission everywhere. An absent legacy
characteristic does not mean `no`. Explicit unknown remains unknown even when a
legacy positive tag exists.

Existing `type` and `characteristics` arrays remain supported. Other facilities
and hazards still use positive tags: their absence is unknown. A future attribute
editor must update structured values explicitly; changing a legacy tag alone
does not override a stored structured value. Search vocabulary and treatment of
unknown/exclusion filters remain separate work; this contract does not change
existing search queries. Ratings continue to use null for unrated areas.

The list (including compact map responses) and detail APIs project attributes
and routes. Read normalization supplies unknown attribute values and empty
collections. Optional fields remain optional on writes, so existing clients can
continue submitting their supported fields without deleting stored extensions.

## Routes

`routes` is an optional collection separate from points and related websites.
The implemented first stage stores external walking routes with a stable ID
within the area, a name, and an HTTP(S) URL. Empty routes mean none are recorded.
A generic point is not promoted to a complete route. Internal route geometry,
distance/elevation metadata, and a route editor remain open implementation work.
Route IDs survive edits; duplicate IDs and invalid URLs are rejected.

## Contribution snapshots and concurrent edits

Contributions retain their own IDs, parent reference, submitter, persisted status
(`pending`, `approved`, `rejected`), creation/update timestamps, review timestamp,
reviewer, and review note. The server derives identity and timestamps, rather
than accepting them from editable location fields.

- `submittedPayload` is the original proposal. New submissions persist a deep
  snapshot, and save/approve/reject never replace it with moderator corrections.
- `payload` remains the working proposal for compatibility with existing review
  clients. Moderator saves change this field, and approval publishes it.
- `basePayload` records the published editable values when a change is submitted.
  It remains unchanged through moderation; new-location proposals have no base.

Parallel submissions remain separately addressable. Approval of a location
change compares its base with current published editable values. A changed field
or deleted point produces HTTP 409 and leaves the proposal pending. No automatic
merge, resurrection, or silent last-write-wins replacement occurs. The final
location update also matches the stored editable fields, protecting the interval
between comparison and publication. A deleted parent returns 404. Resubmit a
stale proposal against current values; moderator conflict resolution is future
work. The base is captured at submission, not when an editor first opens.

This is deliberately conservative: unrelated published changes also require a
fresh proposal. It is not a multi-document transaction or full review audit log.
Simultaneous reviews of the same proposal and recovery after publication succeeds
but contribution status persistence fails still need the dedicated moderation
work. Existing new-location retry deduplication remains in place.

For older contributions, the original submission cannot be recovered if a
moderator already changed it. `submittedPayload` falls back to the oldest payload
still available and is retained on the next review write. Do not label this as a
recovered historical original. Missing historical `basePayload` is never inferred
from today's location: legacy change proposals remain readable/rejectable but
approval returns 409 and requires resubmission. Legacy new-location proposals can
still be reviewed after point migration.

## Deployment and legacy point migration

1. Back up `locations` and `contributions`; pause application and import writes.
2. Run `npm run db:migrate-point-ids` against the intended database. It reports
   changed-document counts and defaults to a dry run, with no data writes.
3. Inspect the counts, then run `npm run db:migrate-point-ids -- --apply` using
   the same database configuration. The script uses the repository's `.env` /
   `MONGODB_URI` and `MONGODB_DB_NAME` conventions.
4. Rerun the dry run; both counts must be zero before deploying/resuming writes.

The migration preserves valid IDs and all point values, assigns persisted IDs
for missing/duplicate identities, and updates points in location documents and
all available contribution snapshots. IDs are scoped to the parent, so repeated
ID strings in different areas are valid. An unchanged id-less pending point can
reuse the parent's ID only when kind, label, and both coordinates match exactly
one parent point. Ambiguous or changed legacy points get separate identities;
the script never guesses based on kind or proximity. Historical base snapshots
and original proposals are not invented. No timestamp or review status is changed.

Writes include the original stored values in their match condition and abort on
concurrent changes. A partially completed migration can be rerun safely; it does
not reassign IDs already stored. Restore the backup to roll back. Import sources
containing id-less points must be migrated before they enter the canonical write
path; the application intentionally has no runtime legacy-ID adapter.

Contract tests exercise missing/partial attributes, explicit negative/unknown
values, repeated point kinds, strict ID validation, precise coordinates, deep
snapshot copies, stale/deleted points, retained submissions, migration identity
alignment, and migration reruns.
