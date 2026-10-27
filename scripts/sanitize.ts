/**
 * Validation for data that reaches plugins.json / themes.json from outside
 * this repository: package metadata from JSR and Algolia, and theme metadata
 * from duneorg/dune-themes. Consumers render these files on web pages, so
 * everything free-form is reduced to plain text and every URL is checked
 * before it is written. (Consumers must still escape on output; this is the
 * second layer.)
 */

/** JSR scope and package names: lowercase letters, digits and hyphens. */
const JSR_NAME = /^[a-z0-9][a-z0-9-]*$/;
/** GitHub owner and repository names. */
const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function isJsrName(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 && JSR_NAME.test(value);
}

export function isGithubName(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 && GITHUB_NAME.test(value) &&
    value !== "." && value !== "..";
}

/** A semver string, or null. */
export function cleanVersion(value: unknown): string | null {
  return typeof value === "string" && value.length <= 64 && SEMVER.test(value) ? value : null;
}

/**
 * Free text as plain text: control characters removed, anything that looks
 * like markup removed, whitespace collapsed, length capped.
 */
export function cleanText(value: unknown, max = 300): string {
  if (typeof value !== "string") return "";
  let text = value
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
  // Tags first (repeatedly, so removal can't assemble a new one), then any
  // stray angle bracket.
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<[^>]*>/g, " ");
  } while (text !== previous);
  text = text.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text;
}

/** An absolute https URL without credentials, or null. */
export function cleanHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
