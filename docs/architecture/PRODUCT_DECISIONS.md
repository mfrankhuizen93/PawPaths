# PawPaths Product and UX Architecture

**Status:** Confirmed product decisions with proposed implementation guidance  
**Last updated:** 2026-10-22  
**Scope:** Product behavior, UX architecture, domain boundaries, and implementation constraints

This document is the central source of truth for PawPaths. It records agreed behavior without implying that unimplemented behavior already exists. Technical recommendations are explicitly marked as proposed, and unresolved choices remain open questions.

## 1. Product vision

PawPaths helps dog owners discover suitable and attractive walking areas, understand their characteristics, navigate to them, and contribute reliable information to the community.

The primary user goal is: **find a great place to walk my dog, understand whether it suits my needs, and easily get there.** Secondary goals are saving places, tracking visits, writing reviews, and correcting or enriching shared information.

The product is mobile-first, intuitive, accessible, and visually appealing. Dutch labels are part of the product design: **Ontdek**, **Zoeken**, **Mijn plekken**, **Profiel**, **Overzicht**, **Kaart**, **Routes**, **Reviews**, and **Navigeer**.

## 2. Decision vocabulary

- **Confirmed decision:** agreed product behavior that future implementation should preserve.
- **Proposed implementation:** a technical or UX recommendation that still needs validation during delivery.
- **Open question:** an unresolved choice; do not treat it as architecture until decided.

## 3. Information architecture and navigation

### Confirmed decisions

The four primary destinations are:

1. **Ontdek** — discovery-first homepage with inspirational locations.
2. **Zoeken** — search, filters, and map exploration.
3. **Mijn plekken** — saved and visited locations.
4. **Profiel** — account, contributions, and moderation status.

Adding a location is contextual, primarily from search or profile. It is not a fifth bottom-navigation destination. The existing application currently uses the root map as the main experience and routes `/location/[slug]` back to it; the redesign should move toward distinct information architecture incrementally rather than silently replacing the current route contract.

### Homepage: Ontdek

- Place a prominent search field at the top.
- Use large, wide, photo-led location cards.
- Do not put filters directly on the homepage.
- Make cards link clearly to location details.
- Show name, area/city, rating, and approximately two important characteristics consistently.
- Make homepage cards visually richer than search-result cards.

### Search: Zoeken

Search covers location names, geographical areas, nearby locations, map exploration, characteristics, facilities, and distance. Important filters include off-leash possibilities, swimming/water, parking, fenced areas, hazards such as bicycle/BMX paths, facilities, and rating.

List and map are alternative full-screen presentations. List cards are compact and scannable. Map shows interactive markers; selecting a marker opens a compact preview that can open the full detail view. Switching presentation preserves the query and active filters. Do not use a cramped split-screen list/map layout on mobile.

### Personal areas

Saving and visiting are separate states. A saved location is not automatically visited. Both collections are reachable through **Mijn plekken**. Contribution history and moderation status are visible in **Profiel**.

## 4. Core user journeys

### Discover and decide

1. User opens Ontdek and sees relevant, inspiring location cards.
2. User searches or switches to Zoeken when the destination or constraints are known.
3. User filters by characteristics, facilities, distance, rating, or nearby position.
4. User selects a location preview or card and opens details.
5. User reviews overview, characteristics, rating, routes, map, and community feedback.
6. User selects Navigeer and chooses an entrance or parking destination.

### Navigate accurately

An area may have multiple entrances and parking locations. Navigeer first presents available destinations, then opens external navigation with the selected point's persisted coordinates. The application must not navigate to an approximate area center or invent a missing entrance/parking point. If no suitable destination exists, explain the limitation and provide a safe fallback only when one is explicitly supported by the data.

### Add a location

1. User chooses Add location contextually.
2. User selects a position on a map and explicitly confirms it.
3. The application attempts to suggest an area name from geographical data.
4. User accepts or edits the name.
5. User signs in if necessary and submits for moderation.

Only a map position is required to begin. A recognizable name is required to submit. Additional attributes and points are optional. There is no persistent draft saving; leaving with unsaved changes warns the user.

### Correct existing information

Users edit published area attributes inline beside the displayed value. The edit becomes a moderation contribution; the published value remains visible until approval. Multiple pending contributions may coexist and must not silently overwrite each other.

## 5. Location detail architecture

The detail view represents a walking **area**, not necessarily one coordinate. It contains:

1. Large hero photograph.
2. Name and geographical context.
3. Rating and important characteristics.
4. Prominent Navigeer action.
5. Concise overview.
6. Tabs: **Overzicht**, **Kaart**, **Routes**, **Reviews**.

The map belongs in the Kaart tab, not embedded in the overview. Navigation remains easily accessible while scrolling. Reviews should reflect the current review capability and data model; do not invent unrelated review features.

## 6. Walking-area domain model

### Conceptual boundaries

- **Walking area identity and geometry:** stable area identity, name, geographical context, and the area geometry or representative position used for discovery. An area is not synonymous with one entrance.
- **Area-level attributes:** facts applying to the area as a whole, such as off-leash classification, fenced status, swimming availability, facilities, hazards, accessibility, description, photos, and external links.
- **Point-level attributes:** independently identifiable coordinates associated with the area. Examples are entrances, parking, swimming/water access, hazards, and route-related points. Multiple points of the same type are valid.
- **Routes:** route entities or route-related data associated with an area; route geometry and metadata should not be forced into a generic point.
- **Community contributions:** immutable proposals referencing an area and carrying a proposed payload, submitter, status, timestamps, and review information.

### Required semantics

Off-leash classification supports **everywhere allowed**, **partially allowed**, **not allowed**, and **unknown**. Unknown is not false. The same distinction applies to other attributes: missing information must remain distinguishable from a confirmed negative value and can invite a contribution.

### Current implementation alignment

The repository already has `LocationListItem`, `EditableLocationFields`, `LocationCoordinatePoint`, `LocationContribution`, a `coordinatePoints` array, and MongoDB contribution review utilities. It also currently stores area-level `latitude`/`longitude` alongside points. This is a useful incremental foundation, but the contract must clarify when area coordinates are representative geometry versus a navigation target. Point IDs, ownership by parent area, and concurrency rules require stronger explicit guarantees.

## 7. Map editor interaction model

The editor is a map beside a manageable list of all points belonging to the area.

### Confirmed behavior

- Show every existing point in both map and list views.
- Select a point from either surface.
- Add multiple points, including repeated types.
- Edit and, where permitted, remove a point.
- Explicitly select a map position.
- Use the same coordinate-selection interaction for add and edit.
- Replace coordinates without relying on marker dragging.
- Enter point-specific details in a focused editing surface when useful.
- Show a clear confirmation of the selected coordinates before save.
- Persist exactly the coordinates shown to the user.

### Proposed implementation

Use a stable client-generated point identity while editing, keep the selected point separate from the map's area center, and submit a normalized point collection in one atomic contribution payload. The map should emit a single canonical coordinate value; the list should render that same value. Prefer a deliberate “Place point” mode and confirmation action over ambiguous map clicks or context-menu-only operations. Add regression tests at the component and server normalization boundaries.

### Critical acceptance invariant

For every saved point, the persisted latitude/longitude must equal the confirmed coordinate (within the documented rounding precision), retain its point ID on edits, and never be replaced by the area center or another selected point. This is P0 behavior.

## 8. Geographical data and name suggestions

The application should suggest the most likely walking-area name using geographical information, preferring a park, forest, nature reserve, or walking area over the nearest street. If multiple names are plausible, choose the strongest match and let the user change it. If no reliable match exists, ask for manual input.

### Proposed implementation

Evaluate reverse geocoding, OpenStreetMap features, and point-in-polygon matching behind a provider-neutral service with attribution, rate limiting, timeout, caching, and fallback behavior. The current repository has `/api/geo/reverse` and `/api/geo/search` and uses Nominatim for reverse lookup; this is a starting point, not an approved final provider architecture.

### Open questions

- Which provider or provider combination gives reliable area-level matches in target countries?
- What licensing, attribution, caching, and rate-limit rules apply?
- Should area geometry come from the same provider as name suggestions?
- What confidence threshold triggers automatic suggestion versus manual entry?

## 9. Duplicate detection

New-location submission warns about potentially existing nearby areas before submission. The user can open an existing location, decide the proposal is genuinely new, and continue. Proximity is evidence for review, never proof of identity; duplicate detection must warn rather than automatically block.

### Proposed implementation

Use a configurable geospatial candidate query plus explainable similarity signals such as name, area type, and overlapping geometry where available. Return a ranked warning list and record the user's continue decision for moderation context.

## 10. Contributions and moderation

New areas, new points, point changes, attribute corrections, and conflicting submissions require approval before publication. Moderators compare published data with proposed data. Parallel pending edits are allowed. A review action must not lose or silently overwrite a competing proposal.

The current repository has pending/approved/rejected contribution statuses, new-location and location-change kinds, admin submissions, review endpoints, source contribution IDs, and tests for idempotent approval. These are useful foundations, but the current model and UI need explicit field-level comparison, conflict handling, submitter history, and visibility outside the admin area.

### Proposed lifecycle

`proposed -> pending -> approved | rejected`, with review metadata and an immutable payload snapshot. Approval should apply a known proposal against the current published version, detect stale or conflicting fields, and require an explicit moderator decision where needed. Rejection retains the proposal and reason. No persistent unfinished drafts are created.

## 11. Accessibility and states

The redesign is mobile-first and keyboard-accessible where applicable. Interactive controls need labels, focus states, and non-color affordances. Map selection and coordinate confirmation need textual, understandable feedback. Every core flow handles loading, empty, error, and unknown-information states. Controls must not look like filters unless they behave as filters.

Existing PawPaths guidance remains normative: reuse Nuxt UI and shared components, use `AppPageHeader` except on the fullscreen root map, use shared skeleton/empty states, keep form inputs at least 16px, use one horizontal tab row per drawer, and confirm before discarding unsaved drawer changes.

## 12. Known UX and architecture inconsistencies

- The root page currently combines map discovery, filters, location detail, editing, reviews, and contribution actions; this makes the intended four-destination architecture difficult to evolve.
- `/location/[slug]` redirects to the root map rather than rendering a dedicated detail page.
- Add location currently opens a full-height drawer containing the broad tabbed `AppLocationForm`; the confirmed creation flow should be short and map-first.
- The point picker supports multiple markers and emits coordinates, but placement is driven by shared map coordinates and context actions; the P0 invariant and explicit list/map selection need regression coverage.
- The data model has a single area latitude/longitude plus a point array, but does not yet document or enforce the distinction between representative area position and navigation destinations.
- Filters currently use generic `type`, `characteristic`, and exclusion parameters; the required filter vocabulary and unknown-value semantics are not yet a stable product contract.
- Reviews are currently posted directly to a location endpoint and rendered in root-page detail state; their placement should align with the detail Reviews tab without expanding scope.
- Contributions are available to maintainers/admins, but profile-facing contribution history and concurrent comparison are not complete.
- Favorites and visited state are not represented in the inspected shared location types or visible API surface.
- Existing map and form labels are mostly English while agreed primary navigation labels are Dutch; this is a product/content consistency concern, not a request to translate the whole application in this documentation task.

## 13. Explicitly rejected alternatives

- A fifth bottom-navigation destination dedicated to adding locations.
- A cramped mobile split-screen list and map.
- Treating an area's approximate center as a navigation destination.
- Inventing a parking or entrance when the data is missing.
- Treating unknown information as a confirmed negative.
- Automatically blocking a submission solely because a nearby area exists.
- Silently overwriting published values with community edits.
- Losing competing pending contributions through last-write-wins behavior.
- Persistent draft saving for unfinished create/edit flows.
- A long, mandatory multi-step wizard for initial location creation.
- Putting the map inside the detail overview instead of its own tab.

## 14. Technical constraints

- Current stack: Nuxt `4.4.5`, Vue `3.5.34`, TypeScript, Nuxt UI `4.7.1`, MapLibre GL `5.24.0`, MongoDB `7.2.0`, and Zod `4.4.3` as declared in `package.json`.
- Preserve incremental compatibility with existing API routes, MongoDB documents, auth, and contribution records.
- Do not introduce database changes merely to document the architecture; validate migrations in implementation issues.
- Keep external geodata provider policy and attribution compliant.
- Keep coordinate precision and normalization explicit and tested.
- Do not add production behavior as part of this documentation change.

## 15. Open technical decisions

1. Dedicated pages versus drawers for each location detail surface, within the existing mobile drawer guidance.
2. Canonical area geometry representation: point, polygon/multipolygon, or a staged hybrid.
3. Stable point ID generation and migration for existing points without IDs.
4. Geodata provider, area-feature matching algorithm, confidence threshold, caching, and fallback.
5. Duplicate similarity scoring and moderator visibility.
6. Conflict model for approving concurrent field-level contributions.
7. Persistence model for saved and visited states and whether visit metadata is needed.
8. Route data model and whether route geometry is stored internally or linked externally.
9. Review moderation, editing, and abuse controls within the existing review scope.
10. Target locales and translation strategy beyond the agreed Dutch navigation labels.

## 16. Implementation sequence

### Phase 1 — Foundations

Document decisions; align area/point/contribution models; fix coordinate selection and persistence; establish reliable multi-point editing and regression coverage.

### Phase 2 — Contributions

Add geodata name suggestions; duplicate warnings; map-first new-location submission; inline edits; moderation comparison and conflict handling; profile contribution status.

### Phase 3 — Discovery

Build the discovery-first homepage; improve search/filter state and full-screen list/map switching; redesign location details and tabs; add destination selection for navigation.

### Phase 4 — Personalization and validation

Add saved/visited management; improve the existing reviews experience; validate mobile usability and accessibility across core flows.

Dependencies and issue-level priorities are tracked in `docs/architecture/BACKLOG.md`.
