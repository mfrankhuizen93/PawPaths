# Issue tracker: GitHub

Track issue scope, acceptance criteria, priorities, dependencies, and
status in https://github.com/mfrankhuizen93/PawPaths/issues.
Keep issue bodies and backlog tracking in GitHub.

Use the gh CLI with --repo mfrankhuizen93/PawPaths explicitly:

- Read: gh issue view <number> --repo mfrankhuizen93/PawPaths
- List: gh issue list --repo mfrankhuizen93/PawPaths
- Create: gh issue create --repo mfrankhuizen93/PawPaths --title "..." --body-file <path>
- Label: gh issue edit <number> --repo mfrankhuizen93/PawPaths --add-label "..."

Use native GitHub sub-issues and dependencies where available.
Otherwise, record parent and blocker references in the GitHub issue body.

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the referenced GitHub issue.

PRs as a request surface: no.
