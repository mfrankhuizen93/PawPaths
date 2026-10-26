# PawPaths Product and UX Architecture

**Status:** Confirmed product decisions with proposed implementation guidance\
**Last updated:** 2026-10-22\
**Scope:** Product behavior, UX architecture, domain boundaries, and implementation constraints

This document is the central source of truth for PawPaths. It records agreed behavior without implying that unimplemented behavior already exists. Technical recommendations are explicitly marked as proposed, and unresolved choices remain open questions.

Issue scope, acceptance criteria, priorities, dependencies, and status are tracked in [GitHub Issues](https://github.com/mfrankhuizen93/PawPaths/issues). This document defines the intended product, not a release checklist. Current implementation observations below were checked against repository source on 2026-10-22; they do not establish deployed behavior.

The [Nuxt UI interaction guide](../nuxt-ui-interaction-guide.md) remains normative for UI implementation. The discovery homepage, map-first creation journey, inline editing, and detail tabs below describe the target product. They do not authorize replacing the guide's shared `AppLocationForm`, drawer-first interactions, or authentication continuation. Reconcile those differences explicitly in the linked delivery issues before implementing them; route composition and authentication timing remain open in section 15.

## 1. Product vision

PawPaths helps dog owners discover suitable and attractive walking areas, understand their characteristics, navigate to them, and contribute reliable information to the community.

The primary user goal is: **find a great place to walk my dog, understand whether it suits my needs, and easily get there.** Secondary goals are saving places, tracking visits, writing reviews, and correcting or enriching shared information.

The product is mobile-first, intuitive, accessible, visually appealing, and multilingual. English (US), locale `en-US`, is the base language for UI labels: **Discover**, **Search**, **My places**, **Profile**, **Overview**, **Map**, **Routes**, **Reviews**, and **Navigate**. These identify destinations and actions; other supported UI languages use their corresponding translated labels.

### Languages and translation

**Confirmed product direction:** serve PawPaths in multiple languages. Treat application UI translation and location-content translation as separate concerns. UI labels are authored in English (US), with maintained translations for other supported languages. Additional supported languages and initial locale selection remain open.

- **UI text:** use maintained translations for labels, navigation, buttons, form help, validation messages, and loading/empty/error states. Resolve them through translation keys for the selected UI language rather than automatically translating rendered UI at runtime. Use the English (US) labels above as the source catalog; other locales provide their translated equivalents. This does not require location content to be submitted or stored in English.
- **Location content:** preserve text in the language it was provided in, including imported and community-submitted text. Automatically translate that content for readers in other supported languages without replacing the original. The original text remains the source for subsequent translations and moderation.
- **Structured location facts:** coordinates, identifiers, URLs, and attribute values retain their meaning across languages. Translate their display labels rather than creating language-specific copies of the underlying facts. For example, the same parking point has a translated point-kind label, while its contributor-provided description retains its original text and can have an automatic translation.

**Proposed implementation:** use locale message catalogs for UI text and a separate translation service for location content. Associate original text with its source language, and associate generated translations with a target language and source revision. Allow source-language metadata per text field or contribution where content within one location uses different languages; do not assume one source language for an entire location. Cache or store generated translations separately and refresh them when the source changes. Display the original while a translation is unavailable or fails, identify automatically translated text, and let readers view the original. Preserve proper place names unless an established localized name is available.

**Open questions:** additional supported languages and initial locale selection; language selection and persistence; translation provider, cost, privacy, and quality controls; language detection and correction for unknown or mixed-language source text; translation timing and storage; translated search; and which text fields, including reviews, receive automatic translation. These implementation choices do not change the direction of preserving original location text and providing automatic translations.

## 2. Decision vocabulary

- **Confirmed decision:** agreed product behavior that future implementation should preserve.
- **Proposed implementation:** a technical or UX recommendation that still needs validation during delivery.
- **Open question:** an unresolved choice; do not treat it as architecture until decided.
- **Current implementation:** an observation supported by the linked source, not proof that the target behavior is complete.

Unless a subsection is explicitly marked otherwise, sections 1 and 3–11 state **confirmed product decisions**. Proposed mechanisms are not approved schema or provider contracts. Sections 12–15 separately record current gaps, rejected alternatives, constraints, and unresolved choices.

## 3. Information architecture and navigation

### Confirmed decisions

The four primary destinations, shown here with their English (US) UI labels, are:

1. **Discover** — discovery-first homepage with inspirational locations.
2. **Search** — search, filters, and map exploration.
3. **My places** — saved and visited locations.
4. **Profile** — account, contributions, and moderation status.

Adding a location is contextual, primarily from search or profile. It is not a fifth bottom-navigation destination. The existing application currently uses the root map as the main experience and routes `/location/[slug]` back to it; the redesign should move toward distinct information architecture incrementally rather than silently replacing the current route contract.

### Homepage: Discover

- Place a prominent search field at the top.
- Use large, wide, photo-led location cards.
- Do not put filters directly on the homepage.
- Make cards link clearly to location details.
- Show name, area/city, rating, and approximately two important characteristics consistently.
- Make homepage cards visually richer than search-result cards.

### Search: Search

Search covers location names, geographical areas, nearby locations, map exploration, characteristics, facilities, and distance. Important filters include off-leash possibilities, swimming/water, parking, fenced areas, hazards such as bicycle/BMX paths, facilities, and rating.

List and map are alternative full-screen presentations. List cards are compact and scannable. Map shows interactive markers; selecting a marker opens a compact preview that can open the full detail view. Switching presentation preserves the query and active filters. Do not use a cramped split-screen list/map layout on mobile.

### Personal areas

Saving and visiting are separate states. A saved location is not automatically visited. Both collections are reachable through **My places**. Contribution history and moderation status are visible in **Profile**.

## 4. Core user journeys

### Discover and decide

1. User opens Discover and sees relevant, inspiring location cards.
2. User searches or switches to Search when the destination or constraints are known.
3. User filters by characteristics, facilities, distance, rating, or nearby position.
4. User selects a location preview or card and opens details.
5. User reviews overview, characteristics, rating, routes, map, and community feedback.
6. User selects Navigate and chooses an entrance or parking destination.

### Navigate accurately

An area may have multiple entrances and parking locations. Navigate first presents available destinations, then opens external navigation with the selected point's persisted coordinates. The application must not navigate to an approximate area center or invent a missing entrance/parking point. If no suitable destination exists, explain the limitation and provide a safe fallback only when one is explicitly supported by the data.

### Add a location

1. User chooses Add location contextually.
2. User selects a position on a map and explicitly confirms it.
3. The application attempts to suggest an area name from geographical data.
4. User accepts or edits the name.
5. User signs in if necessary and submits for moderation.

Only a map position is required to begin. A recognizable name is required to submit. Additional attributes and points are optional. There is no persistent draft saving; leaving with unsaved changes warns the user.

**Current implementation:** signed-out Add first opens shared authentication and continues into the add drawer. The current form and server also require a city. The target journey's later sign-in and smaller required field set are not implemented; issue [#20](https://github.com/mfrankhuizen93/PawPaths/issues/20) must reconcile authentication timing with the UI guide while preserving continuation and entered values.

### Correct existing information

Users edit published area attributes inline beside the displayed value. The edit becomes a moderation contribution; the published value remains visible until approval. Multiple pending contributions may coexist and must not silently overwrite each other.

## 5. Location detail architecture

The detail view represents a walking **area**, not necessarily one coordinate. It contains:

1. Large hero photograph.
2. Name and geographical context.
3. Rating and important characteristics.
4. Prominent Navigate action.
5. Concise overview.
6. Tabs: **Overview**, **Map**, **Routes**, **Reviews**.

The map belongs in the Map tab, not embedded in the overview. Navigation remains easily accessible while scrolling. Reviews should reflect the current review capability and data model; do not invent unrelated review features.

## 6. Walking-area domain model

### Conceptual boundaries

- **Walking area identity and geometry:** stable area identity, name, geographical context, and the area geometry or representative position used for discovery. An area is not synonymous with one entrance.
- **Area-level attributes:** facts applying to the area as a whole, such as off-leash classification, fenced status, swimming availability, facilities, hazards, accessibility, description, photos, and external links.
- **Point-level attributes:** independently identifiable coordinates associated with the area. Examples are entrances, parking, swimming/water access, hazards, and route-related points. Multiple points of the same type are valid.
- **Routes:** route entities or route-related data associated with an area; route geometry and metadata should not be forced into a generic point.
- **Community contributions:** immutable proposals referencing an area and carrying a proposed payload, submitter, status, timestamps, and review information.

### Required semantics

Off-leash classification supports **everywhere allowed**, **partially allowed**, **not allowed**, and **unknown**. Unknown is not false. The same distinction applies to other attributes: missing information must remain distinguishable from a confirmed negative value and can invite a contribution.

An absent characteristic in a legacy array does not establish that it is prohibited or unavailable. Search must not silently classify an unknown attribute as a confirmed positive or negative. A missing rating is unrated, not a zero-star rating. Empty routes or destination points mean there is no recorded usable data; they do not prove that no routes or entrances exist. The storage representation and filter treatment of unknowns remain work for issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15) and [#26](https://github.com/mfrankhuizen93/PawPaths/issues/26).

Routes describe a walk associated with an area and may have geometry and metadata of their own. A route point alone is not a complete route. The staged shared contract supports named external route links; internal geometry and richer metadata remain open.

### Current implementation alignment

The repository has `LocationListItem`, `EditableLocationFields`, `LocationCoordinatePoint`, `LocationContribution`, a `coordinatePoints` array, and MongoDB contribution review utilities. The implemented [location contract](LOCATION_CONTRACT.md) distinguishes representative area coordinates from destination points, requires persisted point IDs, adds explicit unknown attribute values and external route records, and retains original and base contribution snapshots. Existing points require the documented migration before deployment. Boundary geometry, internal route geometry, and full moderation concurrency/recovery remain open.

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
- Show a clear confirmation of the selected map position, using area names or address details when available.
- Persist exactly the confirmed map position.

### Proposed implementation

Use a stable client-generated point identity while editing, keep the selected point separate from the map's area center, and submit a normalized point collection in one atomic contribution payload. The map should emit a single canonical coordinate value; the list should render that same value. Prefer a deliberate “Place point” mode and confirmation action over ambiguous map clicks or context-menu-only operations. Add regression tests at the component and server normalization boundaries.

### Critical acceptance invariant

For every saved point, the persisted latitude/longitude must equal the confirmed coordinate (within the documented rounding precision), retain its point ID on edits, and never be replaced by the area center or another selected point. This is P0 behavior.

**Current implementation:** the shared form stages a single coordinate pair from map clicks or address search and requires explicit confirmation before applying it to the selected area or stable point ID. Switching points or canceling discards the unconfirmed selection; failed submissions retain confirmed values. The [location contract](LOCATION_CONTRACT.md#placement-and-confirmation-precision) specifies six-decimal placement precision and unchanged numeric values through normalization, submission, approval, and reload. Regression tests cover these boundaries and rapid switching using an isolated database double; this does not establish deployed behavior. MongoDB GeoJSON uses `[longitude, latitude]`.

## 8. Geographical data and name suggestions

The application should suggest the most likely walking-area name using geographical information, preferring a park, forest, nature reserve, or walking area over the nearest street. If multiple names are plausible, choose the strongest match and let the user change it. If no reliable match exists, ask for manual input.

Missing geodata, a timeout, or an unavailable provider must leave manual naming and the confirmed coordinates usable. A delayed suggestion must not overwrite a name the user has edited. A name suggestion does not establish area boundaries or a valid navigation destination.

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

Here, `proposed` describes the user's unsaved editing state, not a fourth persisted status. The existing persisted statuses are `pending`, `approved`, and `rejected`. **Confirmed decision:** retain separately addressable competing submissions and review outcomes; prevent publication before approval. The current review API saves moderator corrections to the working payload while preserving new submissions' original snapshot; historical originals cannot be recovered for previously edited legacy records. A saved pending moderation record is distinct from an unfinished personal draft.

**Current implementation:** maintainers/admins can review; a maintainer cannot review their own submission, while an admin can. New submissions retain `submittedPayload` and changes retain `basePayload`; moderator edits affect the working `payload`. Location-change approval rejects changed published bases and matches stored editable fields during publication. Legacy changes lacking a historical base require resubmission. Existing new-location approval checks `sourceContributionId` to avoid duplicate publication on retry, and completed reviews are rejected on repeat. This is not a multi-document atomic review guarantee. Issues [#22](https://github.com/mfrankhuizen93/PawPaths/issues/22) and [#23](https://github.com/mfrankhuizen93/PawPaths/issues/23) still need comparison/resolution UX, simultaneous-review handling, and partial-failure recovery; see the [contract's limits](LOCATION_CONTRACT.md#contribution-snapshots-and-concurrent-edits).

## 11. Accessibility and states

The redesign is mobile-first and keyboard-accessible where applicable. Interactive controls need labels, focus states, and non-color affordances. Map selection and coordinate confirmation need textual, understandable feedback. Every core flow handles loading, empty, error, and unknown-information states. Controls must not look like filters unless they behave as filters.

Existing PawPaths guidance remains normative: reuse Nuxt UI and shared components, use `AppPageHeader` except on the fullscreen root map, use shared skeleton/empty states, keep form inputs at least 16px, use one horizontal tab row per drawer, and confirm before discarding unsaved drawer changes.

Keeping edits in memory allows retries without persistent drafts. Confirming discard abandons those edits; cancelling dismissal retains them. Drawer dismissal, route changes, and authentication interruption need validation in the delivery issues; the shared drawer's dirty-state confirmation alone does not establish that every exit path is protected.

## 12. Known UX and architecture inconsistencies

- The root page currently combines map discovery, filters, location detail, editing, reviews, and contribution actions; this makes the intended four-destination architecture difficult to evolve.
- `/location/[slug]` redirects to the root map rather than rendering a dedicated detail page.
- Add location currently opens a full-height drawer containing the broad tabbed `AppLocationForm`; the confirmed creation flow should be short and map-first.
- The point picker supports multiple markers and emits coordinates, but placement is driven by shared map coordinates and context actions; the P0 invariant and explicit list/map selection need regression coverage.
- The data contract distinguishes the representative area position from destination points, but existing navigation UI still uses area coordinates and requires separate alignment.
- Filters currently use generic `type`, `characteristic`, and exclusion parameters; the required filter vocabulary and unknown-value semantics are not yet a stable product contract.
- Reviews are currently posted directly to a location endpoint and rendered in root-page detail state; their placement should align with the detail Reviews tab without expanding scope.
- Contributions are available to maintainers/admins, but profile-facing contribution history and concurrent comparison are not complete.
- Favorites and visited state are not represented in the inspected shared location types or visible API surface.
- Existing map and form labels are mostly hard-coded English rather than a maintained English (US) source catalog with translations. `package.json` and `nuxt.config.ts` do not configure an application localization system, and the shared location types do not represent source languages or generated translations. The multilingual UI and automatic location-content translations are target behavior, not implemented by this documentation change.
- The current shared form uses Details, Map, Photos, and Links, with Features or Reviews by mode. The target Overview, Map, Routes, Reviews arrangement and inline edits must be reconciled with the guide's shared form requirements in issue #27.
- The current reverse lookup prefers some named area features but can fall back to a street; it does not yet establish reliable area matching, confidence, or provider resilience.
- Original proposal and published-base snapshots now protect new contributions; comparison UX, simultaneous reviews, historical legacy snapshots, and partial-failure recovery remain gaps.

### Source review

These paths support the observations above and give implementation issues a starting point:

| Concern                       | Current source                                                                                                                                                                                                    | Gap or limitation                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Navigation and location links | [`app/navigation/items.ts`](../../app/navigation/items.ts), [`app/pages/location/[slug].vue`](../../app/pages/location/%5Bslug%5D.vue)                                                                            | Explore plus role-specific admin entries; detail links redirect to root selection. Four public destinations are not implemented. |
| Detail, reviews, navigation   | [`app/pages/index.vue`](../../app/pages/index.vue)                                                                                                                                                                | Root orchestrates detail/reviews; external navigation uses area latitude/longitude rather than a chosen destination.             |
| Add and authentication        | [`LocationAddForm.vue`](../../app/components/location/LocationAddForm.vue), [`AppAuthDrawer.vue`](../../app/components/auth/AppAuthDrawer.vue), [`AppLocationForm.vue`](../../app/components/AppLocationForm.vue) | Shared tabbed form after sign-in; profile is currently shown in the auth drawer.                                                 |
| Area, points, attributes      | [`shared/types/locations.ts`](../../shared/types/locations.ts)                                                                                                                                                    | Required point IDs need migration; structured attributes and external routes exist. Saved/visited remain undefined.              |
| Coordinate placement          | [`AppLocationPointPicker.vue`](../../app/components/AppLocationPointPicker.vue), [`editable-location-fields.ts`](../../shared/utils/editable-location-fields.ts)                                                  | Shared selection state and six-decimal placement; persistence invariant still needs regression coverage.                         |
| Geodata                       | [`reverse.get.ts`](../../server/api/geo/reverse.get.ts), [`search.get.ts`](../../server/api/geo/search.get.ts)                                                                                                    | Existing lookup endpoints do not settle the target provider contract.                                                            |
| Contributions and publication | [`location-contributions.ts`](../../server/utils/location-contributions.ts), [`contributions.get.ts`](../../server/api/contributions.get.ts)                                                                      | Pending-only listing; conservative base comparison exists, full review concurrency/recovery does not. City is required.          |
| Unsaved drawer edits          | [`AppDrawer.vue`](../../app/components/drawer/AppDrawer.vue)                                                                                                                                                      | Dirty-state dismissal confirmation exists; all exit paths still require flow validation.                                         |

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
- Replacing original location content with an automatic translation or storing translated UI labels as the identity of structured location facts.

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
3. Point IDs are now required and legacy records have an explicit migration; deployment must run it. Future imports must supply IDs.
4. Geodata provider, area-feature matching algorithm, confidence threshold, caching, and fallback.
5. Duplicate similarity scoring and moderator visibility.
6. Field-level conflict resolution and atomic review recovery beyond the conservative base-snapshot rejection in the location contract.
7. Persistence model for saved and visited states and whether visit metadata is needed.
8. Internal route geometry and metadata beyond the staged external route link contract.
9. Review moderation, editing, and abuse controls within the existing review scope.
10. Additional supported UI/content languages, initial locale selection, and language preference persistence. English (US) (`en-US`) is the established base language for UI labels. Multilingual UI, maintained UI-label translations, preservation of original location text, and automatic location-content translation are established product direction; the provider, source-language metadata, revision tracking, translation timing/storage, field coverage, and search behavior remain open (section 1).
11. How the short map-first creation and inline-edit journeys reuse `AppLocationForm` and reconcile target detail tabs with the current UI guide, without introducing nested tabs or duplicate forms.
12. Whether creation can begin before sign-in, or retains the guide's authentication-first Add behavior; both must preserve intent and unsaved values through authentication or cancellation.

### Tradeoffs and decision boundaries

| Choice                                       | Benefit                                                                                   | Cost or unresolved boundary                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Incremental routes and shared drawers        | Preserves existing links, auth continuation, and form reuse.                              | The discovery homepage and target detail composition require an explicit transition rather than an immediate route replacement. |
| Minimal creation requirements                | Reduces the effort needed to propose a useful area.                                       | Incomplete attributes remain unknown; city validation and optional enrichment must be aligned before delivery.                  |
| Explicit point placement and confirmation    | Makes the intended navigation/edit coordinate understandable.                             | Adds a confirmation step; point identity, precision, and retry behavior need end-to-end validation.                             |
| Parallel moderated contributions             | Allows independent corrections while protecting published information.                    | Requires retained history and conflict comparison; basic pending statuses alone are insufficient.                               |
| Geodata suggestions with manual fallback     | Can improve names without making providers a prerequisite.                                | Matching quality, attribution, service policy, latency, and cost must be evaluated before selecting a provider.                 |
| No persistent unfinished drafts              | Keeps the initial create/edit lifecycle small.                                            | Reloads and deliberate discard lose unfinished work; exit warnings and in-memory retry handling matter.                         |
| Separate UI and location-content translation | Gives UI text maintained wording while preserving each location text's original language. | Automatic content translation needs source tracking, quality controls, fallback behavior, and a provider/storage decision.      |
