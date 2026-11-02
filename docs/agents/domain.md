# Domain docs

This repository uses a single-context layout:

- GLOSSARY.md at the repository root for domain vocabulary.
- docs/adr/ for architectural decision records.

Before exploring domain concepts or architectural decisions:

1. Read the relevant sections of docs/architecture/PRODUCT_DECISIONS.md.
2. Read GLOSSARY.md when present.
3. Read relevant ADRs in docs/adr/ when present.

Missing glossary or ADR files do not block work. Create them lazily
when domain-modeling work resolves terminology or decisions.

Use the glossary's established vocabulary. Surface conflicts with
existing decisions explicitly. Distinguish confirmed decisions,
proposed implementation, and open questions.

PRODUCT_DECISIONS.md remains authoritative for product decisions.
docs/nuxt-ui-interaction-guide.md remains normative for UI work.
