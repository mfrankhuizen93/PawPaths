# GitHub Issue Specifications

These local issue specifications correspond to published GitHub issues #14–#31 in the [backlog index](./BACKLOG.md). Headings and dependencies use GitHub issue numbers; the original draft ordinals 1–18 are no longer used. Each specification references [PRODUCT_DECISIONS.md](./PRODUCT_DECISIONS.md). These are planning records, not implementation completion claims; changes here do not synchronize the published issue bodies.

## #14. Document PawPaths product and UX architecture

**Priority:** P0\
**Labels:** `type:chore`, `area:architecture`, `priority:P0`

### Context

Product and UX decisions are currently distributed across discovery notes, implementation details, and UI guidance. Future work needs one source of truth without presenting unimplemented behavior as complete.

### Desired behavior

Maintain a central architecture document covering product vision, navigation, journeys, domain concepts, map editing, contributions, geodata, search, accessibility, rejected alternatives, constraints, tradeoffs, and open decisions.

### Scope

Create and review `docs/architecture/PRODUCT_DECISIONS.md` and the related backlog index.

### Acceptance criteria

- [ ] Confirmed decisions, proposed implementation, and open questions are visibly distinguished.
- [ ] The four navigation destinations and agreed Dutch labels are documented.
- [ ] Area, point, route, contribution, moderation, and unknown-value semantics are documented.
- [ ] Known current implementation inconsistencies and explicit rejected alternatives are recorded.
- [ ] No production behavior changes are included.

### Edge cases

Document missing geodata, missing destination points, competing contributions, unsaved changes, and unknown attributes.

### Dependencies

None.

### Out of scope

Implementing UI, API, schema, or provider changes.

### Reference

`PRODUCT_DECISIONS.md`, sections 1–15.

## #15. Review and align walking-area, point, and contribution models

**Priority:** P0\
**Labels:** `type:chore`, `area:architecture`, `priority:P0`

### Context

The repository has area latitude/longitude, a `coordinatePoints` array, and contribution payloads, but the contract does not clearly distinguish representative area location from navigable points or define stable point identity and concurrent edit behavior.

### Desired behavior

Define a compatibility-preserving domain contract for area identity/geometry, area attributes, independently identifiable points, routes, and immutable contributions.

### Scope

Review `shared/types/locations.ts`, normalization, MongoDB documents, API payloads, and tests. Propose migrations only where implementation needs them.

### Acceptance criteria

- [ ] Area center/geometry is explicitly distinct from entrances and parking destinations.
- [ ] Multiple points of the same kind and stable point IDs are supported.
- [ ] Unknown is distinct from false for relevant attributes.
- [ ] Contribution payloads preserve submitter, status, timestamps, and proposed values.
- [ ] Existing documents remain readable or have a documented migration path.
- [ ] Contract tests cover normalization and backward compatibility.

### Edge cases

Legacy points without IDs, duplicate point kinds, deleted points in pending edits, and partial/missing attributes.

### Dependencies

Issue [#14](https://github.com/mfrankhuizen93/PawPaths/issues/14).

### Out of scope

Visual redesign and new favorites/visited features.

### Reference

`PRODUCT_DECISIONS.md`, sections 6, 10, and 14–15.

## #16. Fix coordinate selection and persistence in the map editor

**Priority:** P0\
**Labels:** `type:bug`, `area:map`, `priority:P0`

### Context

Selecting a location can save the wrong coordinates. The current picker uses shared latitude/longitude state while also rendering multiple markers, creating a risk that the area center or another point is persisted.

### Desired behavior

The coordinate explicitly selected and confirmed by the user is the coordinate persisted in the contribution payload.

### Scope

Trace `AppLocationPointPicker`, `AppLocationForm`, editable normalization, submission APIs, and approval application. Define one canonical coordinate path and show a confirmation state before save.

### Acceptance criteria

- [ ] Add and edit flows use the same explicit placement interaction.
- [ ] Confirmed latitude/longitude are shown before submission.
- [ ] Persisted coordinates equal the confirmed coordinates within documented precision.
- [ ] The area coordinate cannot replace the active point coordinate accidentally.
- [ ] Regression tests cover add, edit, reload, and approval persistence.
- [ ] Errors leave the user with the unsubmitted confirmed position intact.

### Edge cases

Rapid point switching, map clicks before load, reverse-geocode selection, cancellation, out-of-range coordinates, and rounding.

### Dependencies

Issue [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15).

### Out of scope

New map providers, area polygons, and visual redesign outside the editor.

### Reference

`PRODUCT_DECISIONS.md`, section 7.

## #17. Support reliable multi-point editing per walking area

**Priority:** P0\
**Labels:** `type:feature`, `area:map`, `priority:P0`

### Context

Multiple points are partially supported, but adding repeated types and editing existing points are unreliable and difficult to manage from the map alone.

### Desired behavior

Users manage all area points from a map-plus-list editor: select, add, edit, rename, change type, replace coordinates, and remove where permitted.

### Scope

Build on the point model and coordinate fix. Keep point-specific details in a focused editor if that reduces ambiguity.

### Acceptance criteria

- [ ] Existing points appear in a manageable list and on the map.
- [ ] Multiple points of the same kind can be created and retained.
- [ ] Selecting a point from map or list selects the same record.
- [ ] Editing retains the point ID and updates only that point.
- [ ] Removal is explicit and permission-aware.
- [ ] Add/edit/reload tests verify no point is lost or reassigned.

### Edge cases

Zero points, one point, many points, duplicate labels, legacy IDs, and deleting a point referenced by a pending contribution.

### Dependencies

Issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15) and [#16](https://github.com/mfrankhuizen93/PawPaths/issues/16).

### Out of scope

Route geometry editing and area polygon editing.

### Reference

`PRODUCT_DECISIONS.md`, sections 6–7.

## #18. Implement geodata-based walking-area name suggestions

**Priority:** P1\
**Labels:** `type:feature`, `area:geodata`, `priority:P1`

### Context

New locations need a recognizable name, but nearest-street reverse geocoding may not identify the actual park, forest, or nature reserve.

### Desired behavior

After a confirmed map position, suggest the strongest area-level name, let the user edit it, and require manual entry when confidence is insufficient.

### Scope

Evaluate provider-neutral reverse geocoding, OSM feature matching, point-in-polygon options, attribution, rate limits, caching, timeout, and fallback. Integrate with the existing `/api/geo/reverse` boundary.

### Acceptance criteria

- [ ] Suggestions prefer area features over nearby streets when reliable.
- [ ] Multiple plausible matches are ranked and editable.
- [ ] Low-confidence or unavailable results prompt for a manual name.
- [ ] Provider attribution and usage policy are documented.
- [ ] Provider failure never blocks manual submission when a name is entered.
- [ ] Tests cover success, ambiguity, no match, timeout, and rate-limit responses.

### Edge cases

Water, rural coordinates, multilingual names, borders, provider outages, and no network.

### Dependencies

Issue [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15).

### Out of scope

Choosing the final provider without validation and editing area geometry.

### Reference

`PRODUCT_DECISIONS.md`, section 8.

## #19. Warn about potentially duplicate walking areas

**Priority:** P1\
**Labels:** `type:feature`, `area:geodata`, `area:ux`, `priority:P1`

### Context

New submissions can represent an existing area. Proximity alone cannot prove identity, so users need relevant warnings without an automatic block.

### Desired behavior

Before submission, show ranked nearby or similar locations. Users can open one, continue because the proposal is new, or return to edit.

### Scope

Define a geospatial candidate query and explainable similarity signals. Preserve the user's continue decision for moderation context.

### Acceptance criteria

- [ ] Candidate warnings appear before final submission.
- [ ] Each candidate can open its existing detail view.
- [ ] User can explicitly continue submitting.
- [ ] Nearby distance alone does not block submission.
- [ ] Empty and service-error states allow safe continuation or retry.
- [ ] Tests cover no candidates, multiple candidates, and false positives.

### Edge cases

Overlapping parks, multiple entrances to one area, same names in different cities, and missing coordinates.

### Dependencies

Issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15) and [#18](https://github.com/mfrankhuizen93/PawPaths/issues/18).

### Out of scope

Automatic deduplication or merging published areas.

### Reference

`PRODUCT_DECISIONS.md`, section 9.

## #20. Implement the map-first new walking-area submission flow

**Priority:** P1\
**Labels:** `type:feature`, `area:contributions`, `area:map`, `priority:P1`

### Context

The current add flow exposes the broad location form in a drawer. The agreed creation flow is short, map-first, and requires only a confirmed position to begin.

### Desired behavior

Users select and confirm a map position, review/edit a suggested name, then sign in if needed and submit for moderation. Extra attributes and points are optional.

### Scope

Adapt the existing add drawer/form and auth continuation. Preserve unsaved-change warning and no persistent drafts.

### Acceptance criteria

- [ ] The first required action is selecting a map position.
- [ ] A recognizable name is required before submit.
- [ ] Reverse-geocoded suggestion is editable and manual fallback works.
- [ ] Signed-out users are sent through the shared auth drawer and return to the action.
- [ ] Submission creates a pending contribution, not a published location.
- [ ] Leaving with changes warns and does not persist a draft.

### Edge cases

No name suggestion, duplicate warning, auth cancellation, map failure, and submit retry.

### Dependencies

Issues [#16](https://github.com/mfrankhuizen93/PawPaths/issues/16), [#17](https://github.com/mfrankhuizen93/PawPaths/issues/17), [#18](https://github.com/mfrankhuizen93/PawPaths/issues/18), and [#19](https://github.com/mfrankhuizen93/PawPaths/issues/19).

### Out of scope

Long mandatory wizards and persistent drafts.

### Reference

`PRODUCT_DECISIONS.md`, sections 4 and 8–10.

## #21. Support inline editing of existing area attributes

**Priority:** P1\
**Labels:** `type:feature`, `area:contributions`, `area:ux`, `priority:P1`

### Context

Published area facts should be correctable beside the displayed information without silently overwriting the published record.

### Desired behavior

An authenticated user edits an attribute inline, sees what will be proposed, and submits a moderation contribution. The published value remains visible until approval.

### Scope

Reuse the existing editable field normalization and `AppLocationForm` where appropriate; keep page responsibility focused on state and actions.

### Acceptance criteria

- [ ] Editable attributes expose a clear action beside the displayed value.
- [ ] Unknown and confirmed negative values remain distinguishable.
- [ ] Submitted changes are pending contributions.
- [ ] Published values do not change before approval.
- [ ] Multiple pending proposals can coexist.
- [ ] Unsaved changes trigger the existing confirmation behavior.

### Edge cases

Concurrent edits to the same field, rejected changes, missing permissions, and partial payloads.

### Dependencies

Issue [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15).

### Out of scope

Moderator UI and unrelated review editing.

### Reference

`PRODUCT_DECISIONS.md`, sections 3, 6, and 10.

## #22. Implement the contribution moderation lifecycle

**Priority:** P1\
**Labels:** `type:feature`, `area:moderation`, `area:contributions`, `priority:P1`

### Context

The repository has basic pending/approved/rejected processing and admin submissions, but the product requires a consistent lifecycle for areas, points, and attribute corrections.

### Desired behavior

Moderators compare published data with a proposed snapshot, approve or reject with metadata, and preserve the contribution history.

### Scope

Align API, MongoDB utilities, admin UI, authorization, notifications as applicable, and tests with the documented lifecycle.

### Acceptance criteria

- [ ] New areas, points, point changes, and attribute corrections can be reviewed.
- [ ] Published data remains unchanged while pending.
- [ ] Approval is idempotent and records reviewer/time.
- [ ] Rejection retains the payload and reason.
- [ ] Moderator comparison shows affected fields and coordinates.
- [ ] Unauthorized users cannot review contributions.

### Edge cases

Retry after partial approval, deleted parent area, malformed payload, and rejected competing changes.

### Dependencies

Issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15) and [#21](https://github.com/mfrankhuizen93/PawPaths/issues/21).

### Out of scope

Automatic conflict resolution.

### Reference

`PRODUCT_DECISIONS.md`, section 10.

## #23. Support concurrent pending edits and conflict comparison

**Priority:** P1\
**Labels:** `type:feature`, `area:moderation`, `priority:P1`

### Context

Parallel pending edits are explicitly allowed. Last-write-wins approval could lose information or silently overwrite another proposal.

### Desired behavior

Moderators see competing proposals against the current published value, identify conflicts, and make an explicit decision per conflict or proposal.

### Scope

Add version/snapshot or field-level conflict detection to contribution review. Preserve all submissions and decisions.

### Acceptance criteria

- [ ] Two pending edits to one area remain separately addressable.
- [ ] Moderator view identifies overlapping fields or points.
- [ ] Approval detects stale/conflicting base data.
- [ ] No proposal is silently deleted or overwritten.
- [ ] Decision history records the chosen outcome and reason.
- [ ] Concurrent approval tests cover non-overlapping and conflicting changes.

### Edge cases

Two coordinate moves, one point deleted while another is edited, and approval order reversal.

### Dependencies

Issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15) and [#22](https://github.com/mfrankhuizen93/PawPaths/issues/22).

### Out of scope

Real-time collaborative editing.

### Reference

`PRODUCT_DECISIONS.md`, section 10.

## #24. Show contribution history and moderation status in the profile

**Priority:** P1\
**Labels:** `type:feature`, `area:contributions`, `area:ux`, `priority:P1`

### Context

Contributors need to understand whether their location, point, or correction is pending, approved, or rejected. Current contribution visibility is primarily admin-facing.

### Desired behavior

Profile lists the signed-in user's contributions with status, location, submitted time, review outcome, and useful rejection notes.

### Scope

Add authorized profile API/query and a mobile-friendly profile surface using existing status components where possible.

### Acceptance criteria

- [ ] Users see only their own contributions.
- [ ] Pending, approved, and rejected states are distinguishable without color alone.
- [ ] Each item links to the relevant area when available.
- [ ] Rejection note and reviewed timestamp are shown when present.
- [ ] Empty, loading, and error states are accessible.

### Edge cases

Approved new area without a slug, deleted area, pagination, and unauthenticated access.

### Dependencies

Issues [#22](https://github.com/mfrankhuizen93/PawPaths/issues/22) and [#23](https://github.com/mfrankhuizen93/PawPaths/issues/23).

### Out of scope

Moderator queue redesign.

### Reference

`PRODUCT_DECISIONS.md`, sections 3 and 10.

## #25. Redesign the discover-first homepage

**Priority:** P1\
**Labels:** `type:feature`, `area:ux`, `priority:P1`

### Context

The current root page is map-first and carries search/detail/edit responsibilities. The agreed homepage is inspirational and discovery-first.

### Desired behavior

Ontdek has a prominent search field, wide photo-led cards, consistent summary metadata, and clear detail navigation without homepage filters.

### Scope

Introduce homepage presentation and data loading while reusing existing location/photo/card components and shared loading/empty states.

### Acceptance criteria

- [ ] Homepage exposes the four-destination navigation model.
- [ ] Search is prominent above the discovery content.
- [ ] Cards show name, area/city, rating, and up to two characteristics.
- [ ] Cards are visually richer than compact search results.
- [ ] No filter controls appear as homepage content.
- [ ] Loading, empty, error, and image fallback states work on mobile.

### Edge cases

No photos, no ratings, missing characteristics, slow API, and signed-out user.

### Dependencies

Issue [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15).

### Out of scope

New recommendation algorithms and saved/visited functionality.

### Reference

`PRODUCT_DECISIONS.md`, section 3.

## #26. Improve search, filters, and full-screen list/map switching

**Priority:** P1\
**Labels:** `type:feature`, `area:ux`, `area:map`, `priority:P1`

### Context

The current root page has generic query filters and map behavior, but the required search vocabulary, mobile presentation, and state preservation are not a stable experience.

### Desired behavior

Zoeken supports name/area/nearby search, required characteristics/facilities/distance/rating filters, and full-screen list or map modes that preserve query and filters.

### Scope

Align API query contract, filter semantics, marker preview, list cards, URL state, and responsive layouts. Avoid mobile split-screen.

### Acceptance criteria

- [ ] Required filters include off-leash, water, parking, fenced, hazards, facilities, and rating.
- [ ] Unknown values are not treated as false matches.
- [ ] List and map are alternative full-screen modes on mobile.
- [ ] Switching modes preserves query and active filters.
- [ ] Marker selection opens a compact preview that reaches detail.
- [ ] Keyboard and screen-reader controls expose mode and filter state.

### Edge cases

No results, geolocation denied, stale URL state, many markers, and unavailable map tiles.

### Dependencies

Issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15) and [#16](https://github.com/mfrankhuizen93/PawPaths/issues/16).

### Out of scope

Homepage visual redesign and area geometry editing.

### Reference

`PRODUCT_DECISIONS.md`, section 3.

## #27. Redesign walking-area details and tab structure

**Priority:** P1\
**Labels:** `type:feature`, `area:ux`, `priority:P1`

### Context

`/location/[slug]` currently redirects to the root map, while detail content is embedded in root-page drawer state. The product requires a coherent location detail information architecture.

### Desired behavior

Detail presents hero photo, identity/context, rating, characteristics, prominent navigation, overview, and tabs for Overzicht, Kaart, Routes, and Reviews.

### Scope

Choose a route/drawer composition consistent with the existing UI guide, extract responsibilities from the root page, and reuse review, point, photo, and empty-state components.

### Acceptance criteria

- [ ] Detail has a stable deep link for a walking area.
- [ ] Map is in Kaart, not embedded in Overzicht.
- [ ] Navigeer remains accessible while scrolling.
- [ ] Tabs are one horizontal, mobile-readable row.
- [ ] Reviews use current review data and behavior without invented scope.
- [ ] Loading, missing, and error states are handled.

### Edge cases

No hero image, no routes, no reviews, missing coordinates, and deleted/unavailable location.

### Dependencies

Issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15), [#25](https://github.com/mfrankhuizen93/PawPaths/issues/25), and [#26](https://github.com/mfrankhuizen93/PawPaths/issues/26).

### Out of scope

New review moderation and navigation provider selection.

### Reference

`PRODUCT_DECISIONS.md`, section 5.

## #28. Select navigation destinations for entrances and parking

**Priority:** P1\
**Labels:** `type:feature`, `area:map`, `area:ux`, `priority:P1`

### Context

An area's approximate center is not necessarily a usable destination. Current navigation derives a URL from area latitude/longitude.

### Desired behavior

Navigeer presents available entrances and parking points, then opens external navigation using the selected persisted coordinates.

### Scope

Add destination selection, point-kind filtering, coordinate validation, and graceful missing-destination behavior to detail/navigation actions.

### Acceptance criteria

- [ ] All eligible entrance and parking points are selectable and labeled.
- [ ] Selected destination coordinates are used in the external navigation URL.
- [ ] Area center is not used when a selected point exists.
- [ ] Missing destination points produce a clear fallback state without invented data.
- [ ] Tests verify selected-point URL generation and invalid/missing coordinates.

### Edge cases

Multiple parking points, duplicate labels, one general point, stale point IDs, and unsupported external navigation app.

### Dependencies

Issues [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15), [#17](https://github.com/mfrankhuizen93/PawPaths/issues/17), and [#27](https://github.com/mfrankhuizen93/PawPaths/issues/27).

### Out of scope

Turn-by-turn navigation inside PawPaths.

### Reference

`PRODUCT_DECISIONS.md`, sections 4–6.

## #29. Improve saved and visited location management

**Priority:** P2\
**Labels:** `type:feature`, `area:personalization`, `priority:P2`

### Context

Saved and visited are separate product states, but no inspected shared type/API surface currently represents them.

### Desired behavior

Users can save a location, mark it visited, and manage each collection through Mijn plekken without conflating the states.

### Scope

Define persistence, auth behavior, optimistic/error states, and the Mijn plekken views. Keep the initial implementation incremental.

### Acceptance criteria

- [ ] Save and visited actions are independent.
- [ ] State is visible from location cards and detail.
- [ ] Mijn plekken separates saved and visited collections.
- [ ] Signed-out actions use the shared auth drawer and continue afterward.
- [ ] Empty, loading, and failure states are accessible.

### Edge cases

Duplicate toggles, location deletion, offline failure, and account changes.

### Dependencies

Issue [#27](https://github.com/mfrankhuizen93/PawPaths/issues/27).

### Out of scope

Visit journaling, route tracking, and social sharing.

### Reference

`PRODUCT_DECISIONS.md`, sections 3 and 15.

## #30. Improve the reviews experience within the existing scope

**Priority:** P2\
**Labels:** `type:feature`, `area:ux`, `priority:P2`

### Context

Reviews already have a POST endpoint and root-page rendering. The redesign needs Reviews as a detail tab without inventing unrelated functionality.

### Desired behavior

Users can understand ratings and community feedback in the location's Reviews tab and signed-in users can use the existing review action.

### Scope

Move/recompose current review presentation, preserve existing fields and permissions, and improve loading, empty, error, and accessibility states.

### Acceptance criteria

- [ ] Review count and rating summary match existing API data.
- [ ] Reviews live in the dedicated Reviews tab.
- [ ] Existing signed-in submission behavior remains available.
- [ ] Signed-out users receive the shared auth path.
- [ ] Empty and error states are clear and do not imply missing data is zero.

### Edge cases

No reviews, malformed legacy review dates, missing reviewer names, and failed submission.

### Dependencies

Issue [#27](https://github.com/mfrankhuizen93/PawPaths/issues/27).

### Out of scope

Review editing, moderation, reactions, and new social features.

### Reference

`PRODUCT_DECISIONS.md`, sections 5 and 15.

## #31. Validate mobile usability and accessibility of core flows

**Priority:** P1\
**Labels:** `type:chore`, `area:quality`, `area:ux`, `priority:P1`

### Context

The product is mobile-first and map interactions, drawers, filters, forms, and unknown states need validation beyond implementation confidence.

### Desired behavior

Core flows are usable on small screens, keyboard-accessible where applicable, understandable without color, and robust across loading/empty/error/unknown states.

### Scope

Create a repeatable validation checklist and automated/manual coverage for add, edit points, search mode switching, detail tabs, navigation destination selection, moderation status, and saved/visited states.

### Acceptance criteria

- [ ] Mobile viewport checks cover the core flows without cramped split-screen layouts.
- [ ] Interactive controls have accessible names, focus states, and non-color feedback.
- [ ] Unsaved-change warnings are verified.
- [ ] Map coordinate confirmation has a text alternative/state.
- [ ] Loading, empty, error, and unknown states are tested.
- [ ] Findings are linked to follow-up issues rather than silently deferred.

### Edge cases

Keyboard-only navigation, reduced motion, touch target sizing, slow network, denied geolocation, and screen-reader announcements.

### Dependencies

Issues [#20](https://github.com/mfrankhuizen93/PawPaths/issues/20) and [#25](https://github.com/mfrankhuizen93/PawPaths/issues/25), [#26](https://github.com/mfrankhuizen93/PawPaths/issues/26), [#27](https://github.com/mfrankhuizen93/PawPaths/issues/27), [#28](https://github.com/mfrankhuizen93/PawPaths/issues/28), [#29](https://github.com/mfrankhuizen93/PawPaths/issues/29), [#30](https://github.com/mfrankhuizen93/PawPaths/issues/30); targeted checks may start earlier.

### Out of scope

Full visual rebrand and native mobile applications.

### Reference

`PRODUCT_DECISIONS.md`, sections 11 and 16.
