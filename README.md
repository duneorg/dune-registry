# dune-registry

Aggregated marketplace registry consumed by `getdune.org`'s plugin and
theme library pages — the single source of truth for "what plugins and
themes should we display," refreshed on a schedule rather than looked up
live on every page view.

## Files

- `plugins.json` — first-party `@dune/plugin-*` packages (from the `@dune`
  JSR scope) plus any third-party plugin published anywhere on JSR with
  `dune-plugin` in its package description.
- `themes.json` — first-party `@dune/theme-*` packages actually live on
  JSR, enriched with metadata (demo URL, screenshot, tags) from
  [duneorg/dune-themes](https://github.com/duneorg/dune-themes)'s own
  `registry.json` when available, plus any third-party theme published
  anywhere on JSR with `dune-theme` in its description.

A theme only appears here once it's actually published to JSR — this
repo's pages are specifically about "install via `jsr:`", so an entry
with no real install command would be misleading. `dune-themes`'
`registry.json` remains the authoritative source for what's installable
via its own GitHub-release ZIP pipeline; that's a separate, existing
distribution path unrelated to this repo.

## Why this exists

JSR's own public REST API (`api.jsr.io/packages?query=`) doesn't do real
full-text search over descriptions — seeing details in
`scripts/refresh-registry.ts`'s top comment. JSR's website search works
correctly because it's backed by a separate public Algolia index; this
repo calls that same index directly, but only once a day via a scheduled
job (see `.github/workflows/refresh.yml`), not once per site visitor.

## Running locally

```
deno task refresh
```

Writes `plugins.json` and `themes.json` in place if anything changed.
