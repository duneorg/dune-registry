/**
 * Refreshes plugins.json and themes.json — the aggregated marketplace
 * registry consumed by getdune.org's plugin/theme library pages.
 *
 * First-party data comes from fully-documented, sanctioned public APIs:
 *   - plugins: the @dune JSR scope, filtered to package names starting
 *     with "plugin-" (a structural guarantee — doesn't depend on anyone
 *     remembering to write a marker in a description).
 *   - themes: duneorg/dune-themes' own registry.json (that repo's real
 *     source of truth, synced atomically with its own release pipeline).
 *
 * Third-party data (any scope, opted in via a "dune-plugin"/"dune-theme"
 * marker in the package description) comes from JSR's own search, which
 * is backed by a public Algolia index — not JSR's api.jsr.io/packages
 * REST endpoint, which does not do real full-text search (query=dune-plugin
 * reproducibly returns 0 hits there, confirmed 2026-07). These are JSR's
 * own public search-only Algolia credentials, read out of jsr.io's shipped
 * frontend JS bundle — a search-only key is meant to be exposed client-side
 * like this, same as JSR's own site does. If JSR ever rotates them this
 * script starts failing loudly (non-zero exit) rather than silently.
 *
 * Run on a schedule (see .github/workflows/refresh.yml), not per-request —
 * this is the whole point: Algolia gets called once a day, not once per
 * site visitor.
 */

const ALGOLIA_APP_ID = "NM4F4ZN5Z1";
const ALGOLIA_SEARCH_KEY = "f1c9c5e7309104ac81f7d333036fb0ad";
const ALGOLIA_INDEX = "prod_packages";

interface JsrPackage {
  scope: string;
  name: string;
  description: string | null;
  latestVersion: string | null;
  githubRepository: { owner: string; name: string } | null;
}

interface RegistryEntry {
  scope: string | null;
  name: string;
  displayName: string;
  description: string;
  version: string | null;
  tags: string[];
  demoUrl: string | null;
  screenshotUrl: string | null;
  downloadUrl: string | null;
  sha256: string | null;
  jsrInstall: string | null;
  jsrUrl: string | null;
  githubUrl: string | null;
  source: "first-party" | "discovered";
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchDuneScopePackages(): Promise<JsrPackage[]> {
  const data = await fetchJson("https://api.jsr.io/scopes/dune/packages?limit=100");
  return data.items ?? [];
}

async function algoliaSearch(query: string): Promise<JsrPackage[]> {
  const data = await fetchJson(
    `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`,
    {
      method: "POST",
      headers: {
        "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, hitsPerPage: 100 }),
    },
  );
  return data.hits ?? [];
}

/** Third-party hits from Algolia are missing latestVersion/githubRepository — fill them in. */
async function enrichPackage(p: JsrPackage): Promise<JsrPackage> {
  if (p.latestVersion && p.githubRepository !== undefined) return p;
  try {
    const full = await fetchJson(`https://api.jsr.io/scopes/${p.scope}/packages/${p.name}`);
    return { ...p, latestVersion: full.latestVersion ?? null, githubRepository: full.githubRepository ?? null };
  } catch {
    return p;
  }
}

function toEntry(p: JsrPackage, source: "first-party" | "discovered"): RegistryEntry {
  return {
    scope: p.scope,
    name: p.name,
    displayName: `@${p.scope}/${p.name}`,
    description: p.description ?? "",
    version: p.latestVersion,
    tags: [],
    demoUrl: null,
    screenshotUrl: null,
    downloadUrl: null,
    sha256: null,
    jsrInstall: p.latestVersion ? `jsr:@${p.scope}/${p.name}@^${p.latestVersion}` : `jsr:@${p.scope}/${p.name}`,
    jsrUrl: `https://jsr.io/@${p.scope}/${p.name}`,
    githubUrl: p.githubRepository
      ? `https://github.com/${p.githubRepository.owner}/${p.githubRepository.name}`
      : null,
    source,
  };
}

async function buildPlugins(scopePackages: JsrPackage[]): Promise<RegistryEntry[]> {
  const firstParty = scopePackages
    .filter((p) => p.name.startsWith("plugin-"))
    .map((p) => toEntry(p, "first-party"));

  const firstPartyKeys = new Set(firstParty.map((e) => `${e.scope}/${e.name}`));
  const discoveredRaw = await algoliaSearch("dune-plugin");
  const discovered: RegistryEntry[] = [];
  for (const hit of discoveredRaw) {
    const key = `${hit.scope}/${hit.name}`;
    if (firstPartyKeys.has(key)) continue; // first-party already covered structurally
    if (!(hit.description ?? "").toLowerCase().includes("dune-plugin")) continue;
    discovered.push(toEntry(await enrichPackage(hit), "discovered"));
  }

  return [...firstParty, ...discovered];
}

async function buildThemes(scopePackages: JsrPackage[]): Promise<RegistryEntry[]> {
  // A theme is only listed here if it is actually live on JSR — this page
  // says "Install from JSR", so an entry with no real jsr: install command
  // would be a broken promise. dune-themes/registry.json's own "jsr" field
  // is aspirational (written before publishing, not proof of publishing),
  // so it's only used to enrich an already-confirmed-live JSR package with
  // its demo/screenshot/tags — never to decide whether to list it at all.
  const liveThemePackages = scopePackages.filter((p) => p.name.startsWith("theme-"));

  let themesRegistry: { themes?: any[] } = {};
  try {
    themesRegistry = await fetchJson(
      "https://raw.githubusercontent.com/duneorg/dune-themes/main/registry.json",
    );
  } catch {
    // Enrichment is optional — a live JSR theme still gets listed (with
    // less metadata) even if this fetch fails.
  }
  const bySlug = new Map((themesRegistry.themes ?? []).map((t: any) => [t.slug, t]));

  const firstParty: RegistryEntry[] = liveThemePackages.map((p) => {
    const slug = p.name.replace(/^theme-/, "");
    const meta = bySlug.get(slug);
    return {
      scope: p.scope,
      name: p.name,
      displayName: meta?.name ?? `@${p.scope}/${p.name}`,
      description: p.description ?? meta?.description ?? "",
      version: p.latestVersion,
      tags: meta?.tags ?? [],
      demoUrl: meta?.demoUrl ?? null,
      screenshotUrl: meta?.screenshotUrl ?? null,
      downloadUrl: meta?.downloadUrl ?? null,
      sha256: meta?.sha256 || null,
      jsrInstall: p.latestVersion ? `jsr:@${p.scope}/${p.name}@^${p.latestVersion}` : `jsr:@${p.scope}/${p.name}`,
      jsrUrl: `https://jsr.io/@${p.scope}/${p.name}`,
      githubUrl: p.githubRepository
        ? `https://github.com/${p.githubRepository.owner}/${p.githubRepository.name}`
        : `https://github.com/duneorg/dune-themes/tree/main/packages/theme-${slug}`,
      source: "first-party" as const,
    };
  });

  const firstPartyKeys = new Set(firstParty.map((e) => `${e.scope}/${e.name}`));
  const discoveredRaw = await algoliaSearch("dune-theme");
  const discovered: RegistryEntry[] = [];
  for (const hit of discoveredRaw) {
    const key = `${hit.scope}/${hit.name}`;
    if (firstPartyKeys.has(key)) continue;
    if (!(hit.description ?? "").toLowerCase().includes("dune-theme")) continue;
    discovered.push(toEntry(await enrichPackage(hit), "discovered"));
  }

  return [...firstParty, ...discovered];
}

/**
 * Writes {path} only if `entries` differs from what's already there —
 * compared on the entries themselves, not the wrapping object, since
 * `updatedAt` is always "now" and would otherwise make every run look
 * like a change (defeating the point of a diff check: an unattended
 * commit-if-changed job should actually skip committing when nothing
 * changed).
 */
async function writeIfChanged(path: string, key: string, entries: unknown) {
  const entriesJson = JSON.stringify(entries);
  let previousEntriesJson: string | null = null;
  try {
    const parsed = JSON.parse(await Deno.readTextFile(path));
    previousEntriesJson = JSON.stringify(parsed[key]);
  } catch {
    // file doesn't exist yet, or isn't valid JSON — treat as changed
  }
  if (previousEntriesJson === entriesJson) {
    console.log(`${path}: unchanged`);
    return false;
  }
  const next = JSON.stringify({ updatedAt: new Date().toISOString(), [key]: entries }, null, 2) + "\n";
  await Deno.writeTextFile(path, next);
  console.log(`${path}: updated`);
  return true;
}

const scopePackages = await fetchDuneScopePackages();
const plugins = await buildPlugins(scopePackages);
const themes = await buildThemes(scopePackages);

const changedPlugins = await writeIfChanged("plugins.json", "plugins", plugins);
const changedThemes = await writeIfChanged("themes.json", "themes", themes);

if (changedPlugins || changedThemes) {
  console.log("::set-output name=changed::true");
}
