# PawPaths Nuxt UI Interaction & Component Guide

PawPaths uses Nuxt UI as the foundation for layout, interaction, and visual
consistency.

Do not over-customize styling. Colors, radius, shadows, and component states
should mostly come from the configured Nuxt UI theme.

The main focus should be on:

- Consistent reusable components
- Drawer-based detail views
- Shared loading skeletons
- Thin pages
- Reusing existing Nuxt UI components
- Reusing existing PawPaths components whenever possible

## Core Interaction Model

PawPaths is a drawer-first app. Pages show overview content first. Detail
content opens in a `UDrawer`.

This applies across the app:

- Map locations
- Community submissions
- User roles
- Saved locations
- Admin review flows
- Future entity detail views

A user should generally not leave the overview page just to inspect an item.
Instead:

1. The user clicks a marker, card, row, or list item.
2. The selected item is stored in page state.
3. A `UDrawer` opens from the bottom.
4. The drawer displays the item detail content.
5. `UTabs` separate different kinds of content.

Drawers should open from the bottom by default:

```vue
<UDrawer direction="bottom" />
```

Use the bottom drawer for location details, community submissions, user roles,
validation, moderation, and future entity detail views unless there is a strong
reason to use a different interaction.

## Shared Drawer Pattern

Use the same high-level pattern across entities:

```text
EntityDrawer
  AppDrawer
    EntityDrawerHeader
    AppDrawerTabs
    EntityDrawerActions
```

Recommended shared components:

```text
components/drawer/AppDrawer.vue
components/drawer/AppDrawerHeader.vue
components/drawer/AppDrawerTabs.vue
components/drawer/AppDrawerActions.vue
```

Domain drawers should compose these shared components. Examples include
`LocationDrawer`, `CommunitySubmissionDrawer`, and `UserRoleDrawer`.

## Root Map Page

The root page shows the map. Clicking a marker sets `selectedLocation`, opens a
bottom `LocationDrawer`, and renders location content in tabs. A marker click
must not navigate to a detail page.

Recommended structure:

```vue
<template>
  <MapPageLayout>
    <LocationMap
      :locations="locations"
      :selected-location-id="selectedLocation?.id"
      @select-location="openLocation"
    />
    <LocationDrawer
      v-model:open="isLocationDrawerOpen"
      :location="selectedLocation"
    />
  </MapPageLayout>
</template>
```

The location drawer is the primary location detail view. Recommended tabs are
Overview, Details, Notes, and Photos, with Reviews, Nearby, History, and Admin
added only when useful. Put the most useful dog-owner information first.

Reuse the drawer and its location content across map markers, location cards,
saved locations, community validation, and admin review.

## Community Submissions

Show submitted locations or edits in a list, card, or table overview. Clicking
an item opens a bottom drawer instead of navigating away.

Recommended tabs:

- Submission
- Location Preview
- Validation
- History

The location preview should reuse location content components. Approval,
rejection, and editing actions belong in the Validation tab or drawer actions.

## User Roles

Show users in a table where desktop space allows and a simplified list or cards
on mobile. Clicking a user opens a bottom drawer.

Recommended tabs:

- Profile
- Permissions
- Activity

Role-changing actions belong inside the drawer.

## Tabs

Use `UTabs` when drawer content naturally belongs to distinct categories. Tabs
should prevent drawers from becoming long, chaotic pages. Do not use tabs for
tiny amounts of content; two short sections can use headings instead.

## Loading States

Use loading states that match the final layout. Prefer Nuxt UI skeletons over a
generic spinner for large content areas.

Examples:

- Location card: `LocationCardSkeleton`
- Location drawer: `LocationDrawerSkeleton`
- Community list: `CommunitySubmissionListSkeleton`
- Community drawer: `CommunitySubmissionDrawerSkeleton`
- User table: `UserRolesTableSkeleton`
- User drawer: `UserRoleDrawerSkeleton`
- Form: disabled fields or a form skeleton
- Map: map placeholder or map skeleton

Recommended common components:

```text
components/common/AppSkeletonCard.vue
components/common/AppSkeletonRows.vue
```

Skeletons must visually match the layout they replace.

## Empty States

Use `components/common/AppEmptyState.vue`, a wrapper around Nuxt UI's empty
component. Do not use `UEmpty` directly throughout the app. The wrapper keeps
spacing, icons, actions, and copy consistent.

```vue
<AppEmptyState
  icon="i-lucide-map"
  title="No locations found"
  description="Try changing your filters or add a new location."
  action-label="Add location"
  @action="openAddLocation"
/>
```

## Forms

Use Nuxt UI form controls. Every input, select, textarea, combobox, location
search, and upload field must be full width with `w-full`.

On desktop, fields may sit side by side, but together they should fill the
available width.

All input text must be at least 16px (`text-base`) to prevent iPhone Safari from
zooming focused controls.

Create and reuse app-level wrappers:

```text
components/form/AppTextField.vue
components/form/AppTextareaField.vue
components/form/AppSelectField.vue
components/form/AppCheckboxField.vue
components/form/AppLocationSearchField.vue
components/form/AppImageUploadField.vue
```

These wrappers enforce full width, 16px text, consistent size and variant,
labels, helper text, and error display. Avoid repeated raw `UInput` and
`UFormField` markup.

## Component Reuse

Before creating a component:

1. Check whether Nuxt UI already provides it.
2. Check whether PawPaths already has a wrapper or domain component.
3. Reuse existing components whenever possible.
4. Extract a UI pattern when it appears more than once.
5. Split components that become too large.

Pages should compose components rather than contain large UI blocks.

Use clear domain names such as `LocationDrawer`, `LocationTypeBadge`,
`CommunitySubmissionList`, `UserRoleDrawer`, `AppEmptyState`, and
`AppTextField`. Avoid vague names such as `InfoBox`, `ThingDrawer`,
`CustomCard`, and `DataThing`.

## Suggested Structure

```text
components/
  common/
    AppEmptyState.vue
    AppPageHeader.vue
    AppSkeletonCard.vue
    AppSkeletonRows.vue
  drawer/
    AppDrawer.vue
    AppDrawerHeader.vue
    AppDrawerActions.vue
  form/
    AppTextField.vue
    AppTextareaField.vue
    AppSelectField.vue
    AppCheckboxField.vue
    AppLocationSearchField.vue
    AppImageUploadField.vue
  location/
    LocationMap.vue
    LocationMarker.vue
    LocationDrawer.vue
    LocationDrawerSkeleton.vue
    LocationTabs.vue
    LocationCard.vue
    LocationCardSkeleton.vue
    LocationTypeBadge.vue
    LocationFeatureChips.vue
    LocationActions.vue
    LocationMetaList.vue
    LocationCommunityNotes.vue
  community/
    CommunitySubmissionList.vue
    CommunitySubmissionListSkeleton.vue
    CommunitySubmissionDrawer.vue
    CommunitySubmissionDrawerSkeleton.vue
    CommunitySubmissionStatusBadge.vue
    CommunitySubmissionActions.vue
  users/
    UserRolesTable.vue
    UserRolesTableSkeleton.vue
    UserRoleDrawer.vue
    UserRoleDrawerSkeleton.vue
    UserRoleBadge.vue
    UserPermissionsForm.vue
```

## Page Responsibility

### Standard Page Header

Every page except the fullscreen root map page must start with one consistent
top-level page header. Use `components/common/AppPageHeader.vue`.

The header should contain:

- An optional eyebrow that identifies the area, such as Administration,
  Account, or Community
- One page title
- One short description where useful
- An optional amount badge beside the title
- Page-level actions, such as refresh or create, aligned in the header action
  area

Do not repeat the page title or description again above the main content. If a
page needs an amount badge or refresh button, keep those controls in the single
top page header rather than adding a second section heading.

Recommended structure:

```vue
<AppPageHeader
  :badge="items.length"
  description="Review and manage the items in this queue."
  eyebrow="Administration"
  title="Items"
>
  <template #actions>
    <UButton
      :loading="loading"
      icon="i-lucide-refresh-cw"
      label="Refresh"
      variant="subtle"
      @click="refresh"
    />
  </template>
</AppPageHeader>
```

On mobile, the action area may wrap or stack below the title content. The root
map page is exempt because the map is the fullscreen primary interface.

Pages should handle:

- Fetching or requesting data
- Holding selected item state
- Opening and closing drawers
- Passing props to components
- Handling high-level actions

Pages should not contain:

- Large UI blocks
- Repeated card markup
- Repeated drawer markup
- Repeated form field markup
- Hard-coded empty states
- Hard-coded skeletons

Use this overview-plus-drawer pattern:

```vue
<script setup lang="ts">
const selectedItem = ref(null);
const drawerOpen = ref(false);

function openItem(item) {
  selectedItem.value = item;
  drawerOpen.value = true;
}
</script>

<template>
  <PageLayout>
    <EntityOverview :items="items" @select="openItem" />
    <EntityDrawer v-model:open="drawerOpen" :item="selectedItem" />
  </PageLayout>
</template>
```

Use the same pattern for map locations, community submissions, user roles,
saved items, and admin review queues.

## Styling

Prefer the Nuxt UI theme, Nuxt UI variants, shared wrappers, semantic classes,
and small layout utilities.

Avoid one-off colors, button styles, input styles, shadows, and radii. Do not
recreate Nuxt UI components manually.

## Implementation Checklist

When implementing PawPaths UI:

1. Use Nuxt UI components first.
2. Use the configured Nuxt UI theme for colors.
3. Do not over-customize colors in individual components.
4. Use drawer-first interaction patterns.
5. Open entity details in `UDrawer`.
6. Use bottom drawers by default.
7. Use `UTabs` inside drawers where content has clear sections.
8. Reuse location content across map and community validation.
9. Use matching skeletons for loading states.
10. Use `AppEmptyState` for empty states.
11. Make form fields full width.
12. Use at least 16px text size for all inputs.
13. Make reusable components for repeated UI elements.
14. Reuse existing PawPaths components whenever possible.
15. Keep pages thin and focused on state/data orchestration.
16. Use one `AppPageHeader` on every page except the fullscreen root map.
17. Keep page counts and page-level actions in that header.
18. Do not repeat the page title or description above the content.

## Main Principle

PawPaths should feel like a consistent Nuxt UI app with a shared drawer-first
detail pattern. Users browse overview screens, click an item, and inspect or
manage it in a bottom drawer. The same interaction model should work across the
map, community submissions, user roles, and future admin pages.
