# PawPaths Architecture and UX Backlog

This index is the implementation backlog for `PRODUCT_DECISIONS.md`. GitHub links are filled in when the corresponding issue is created. No milestones or due dates are assigned.

## Priority and labels

- **P0:** critical foundation or broken existing behavior.
- **P1:** essential redesign functionality.
- **P2:** secondary improvement.
- Suggested labels: `type:feature`, `type:bug`, `type:chore`, `area:map`, `area:geodata`, `area:contributions`, `area:moderation`, `area:ux`, `area:personalization`, `area:quality`, `area:architecture`, `priority:P0`, `priority:P1`, `priority:P2`.

## Issue index

| # | Title | Priority | Dependencies | Phase |
|---|---|---:|---|---|
| [#14](https://github.com/mfrankhuizen93/PawPaths/issues/14) | Document PawPaths product and UX architecture | P0 | — | 1 |
| [#15](https://github.com/mfrankhuizen93/PawPaths/issues/15) | Review and align walking-area, point, and contribution models | P0 | 1 | 1 |
| [#16](https://github.com/mfrankhuizen93/PawPaths/issues/16) | Fix coordinate selection and persistence in the map editor | P0 | 2 | 1 |
| [#17](https://github.com/mfrankhuizen93/PawPaths/issues/17) | Support reliable multi-point editing per walking area | P0 | 2, 3 | 1 |
| [#18](https://github.com/mfrankhuizen93/PawPaths/issues/18) | Implement geodata-based walking-area name suggestions | P1 | 2 | 2 |
| [#19](https://github.com/mfrankhuizen93/PawPaths/issues/19) | Warn about potentially duplicate walking areas | P1 | 2, 5 | 2 |
| [#20](https://github.com/mfrankhuizen93/PawPaths/issues/20) | Implement the map-first new walking-area submission flow | P1 | 3, 4, 5, 6 | 2 |
| [#21](https://github.com/mfrankhuizen93/PawPaths/issues/21) | Support inline editing of existing area attributes | P1 | 2 | 2 |
| [#22](https://github.com/mfrankhuizen93/PawPaths/issues/22) | Implement the contribution moderation lifecycle | P1 | 2, 8 | 2 |
| [#23](https://github.com/mfrankhuizen93/PawPaths/issues/23) | Support concurrent pending edits and conflict comparison | P1 | 2, 9 | 2 |
| [#24](https://github.com/mfrankhuizen93/PawPaths/issues/24) | Show contribution history and status in the profile | P1 | 9, 10 | 2 |
| [#25](https://github.com/mfrankhuizen93/PawPaths/issues/25) | Redesign the discover-first homepage | P1 | 2 | 3 |
| [#26](https://github.com/mfrankhuizen93/PawPaths/issues/26) | Improve search, filters, and full-screen list/map switching | P1 | 2, 3 | 3 |
| [#27](https://github.com/mfrankhuizen93/PawPaths/issues/27) | Redesign walking-area details and tab structure | P1 | 2, 12, 13 | 3 |
| [#28](https://github.com/mfrankhuizen93/PawPaths/issues/28) | Select navigation destinations for entrances and parking | P1 | 2, 4, 14 | 3 |
| [#29](https://github.com/mfrankhuizen93/PawPaths/issues/29) | Improve saved and visited location management | P2 | 14 | 4 |
| [#30](https://github.com/mfrankhuizen93/PawPaths/issues/30) | Improve the reviews experience within the existing scope | P2 | 14 | 4 |
| [#31](https://github.com/mfrankhuizen93/PawPaths/issues/31) | Validate mobile usability and accessibility of core flows | P1 | 7, 12–17 | 4 |

## Recommended execution

Start with issues 1–4. Do not begin the visual redesign until coordinate persistence and point identity are reliable. Then deliver 5–11 as one contribution/moderation slice, followed by 12–15 for discovery and navigation. Finish with 16–18. Issue 18 can run targeted audits earlier, but its full acceptance pass depends on the core flows being available.

## Known blockers and risks

- GitHub API access and repository permissions are required to publish this backlog.
- The local checkout is 11 commits behind `origin/main`; the branch is based on the current local `main` and should be rebased or reviewed against the latest default branch before merge.
- Existing point records may lack stable IDs; issue 2 must define a safe compatibility strategy before issue 4 changes persistence.
- The current Nominatim reverse-geocoder is not automatically approved for area-name matching; provider policy and licensing must be validated in issue 5.
- Favorites and visited states have no inspected shared type/API foundation; issue 16 should not be pulled into the earlier domain-model work without a product decision.

## References

- Central decisions: [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md)
- Existing UI interaction constraints: [`../nuxt-ui-interaction-guide.md`](../nuxt-ui-interaction-guide.md)
