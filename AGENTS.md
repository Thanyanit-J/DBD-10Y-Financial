# DBD 10Y Financial

Chrome extension that changes the DBD DataWarehouse frontend to show up to 10 years of financial data at once (the site shows 5 years at a time). It requests only the Fiscal Years the site's own dropdown offers; see `docs/adr/0002-bound-history-to-dbd-fiscal-year-options.md`.

## Workflow

One branch per ticket, from `main`, named `<issue-number>-<short-title>` (for example `2-bound-actual-history-to-dbd-fiscal-year-options`). Commit there, run `/code-review` on the branch, then open a pull request against `main`. A human reviews and merges; `main` and version branches move only by merge.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for this repo, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
