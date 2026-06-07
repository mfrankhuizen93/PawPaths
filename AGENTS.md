# PawPaths Repository Instructions

All UI work in this repository must follow
[`docs/nuxt-ui-interaction-guide.md`](docs/nuxt-ui-interaction-guide.md).

Before changing a page or component:

1. Reuse Nuxt UI and existing PawPaths components.
2. Keep pages focused on data, selection state, and high-level actions.
3. Use bottom `UDrawer` detail views instead of navigation where practical.
4. Use `UTabs` for substantial, naturally grouped drawer content.
5. Use layout-matching skeletons and the shared `AppEmptyState`.
6. Keep form controls full width with at least 16px input text.
7. Prefer the configured Nuxt UI theme over one-off visual styling.
8. Use one `AppPageHeader` on every page except the fullscreen root map.
9. Keep counts and page-level actions in that header; do not repeat headings.

## Branch Names

New branches must use one of these purpose prefixes:

`feature/`, `bugfix/`, `hotfix/`, `design/`, `refactor/`, `test/`, or `doc/`.

Keep names short and descriptive, use hyphens between words, and avoid vague
terms such as `update`, `changes`, or `stuff`. The existing
`ux/nuxt-ui-drawer-first` branch is exempt because it predates this convention.

The full guide is normative. If it conflicts with an existing implementation,
improve the implementation toward the guide without unrelated rewrites.
