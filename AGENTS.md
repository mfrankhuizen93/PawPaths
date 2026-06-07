# PawPaths Repository Instructions

All UI work in this repository must follow
[`docs/nuxt-ui-interaction-guide.md`](docs/nuxt-ui-interaction-guide.md).
The full guide is normative. If it conflicts with an existing implementation,
improve the implementation toward the guide without unrelated rewrites.

## UI Guidelines

PawPaths uses Nuxt UI as the foundation for layout, interaction, and visual
consistency.

Before changing a page or component:

1. Reuse Nuxt UI and existing PawPaths components.
2. Keep pages focused on data, selection state, and high-level actions.
3. Use bottom `UDrawer` detail views instead of navigation where practical.
4. Use `UTabs` for substantial, naturally grouped drawer content.
5. Use layout-matching skeletons for loading states.
6. Use the shared `AppEmptyState` for empty states.
7. Keep form fields full width with at least 16px input text.
8. Prefer the configured Nuxt UI theme over one-off styling. Colors, radius,
   shadows, and component states should mostly come from the theme.
9. Keep tab labels short and make tab rows horizontally scrollable on mobile.
10. Confirm before closing routes, drawers, or other views with unsaved changes.
11. Use one `AppPageHeader` on every page except the fullscreen root map.
12. Keep counts and page-level actions in that header; do not repeat headings.
13. Do not add Close buttons to drawers; use the drawer's native close gestures.
14. Reuse the tabbed `AppLocationForm` for adding, editing, reviewing, and
    readonly location views.
15. Keep Add location beside Filters on the map and out of footer navigation.
16. Open the shared auth drawer when signed-out users choose Add or Profile.
17. After authentication, continue the action that opened the auth drawer.
18. Use one horizontal tab row per drawer; never nest tabs inside drawer tabs.
19. Keep form actions in the drawer footer and save all tabs together.

## Branch Names

New branches must use one of these purpose prefixes:

`feature/`, `bugfix/`, `hotfix/`, `design/`, `refactor/`, `test/`, or `doc/`.

Keep names short and descriptive, use hyphens between words, and avoid vague
terms such as `update`, `changes`, or `stuff`.
