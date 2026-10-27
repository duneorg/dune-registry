import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cleanHttpsUrl, cleanText, cleanVersion, isGithubName, isJsrName } from "./sanitize.ts";

Deno.test("cleanText: plain text passes through unchanged", () => {
  assertEquals(
    cleanText("Admin Plug-in for Dune CMS https://jsr.io/@dune/core (dune-plugin)"),
    "Admin Plug-in for Dune CMS https://jsr.io/@dune/core (dune-plugin)",
  );
});

Deno.test("cleanText: markup is removed, including nested and unclosed forms", () => {
  assertEquals(cleanText("a <img src=x onerror=alert(1)> b"), "a b");
  assertEquals(cleanText("<script>alert(1)</script>hello"), "alert(1) hello");
  assertEquals(cleanText("x <<b>script>y"), "x scripty");
  assertEquals(cleanText("x <img src=x onerror=alert(1)//"), "x img src=x onerror=alert(1)//");
  for (const t of ["<", ">", "a<b", "a>b", "<<<>>>"]) {
    assertEquals(/[<>]/.test(cleanText(t)), false);
  }
});

Deno.test("cleanText: control characters and whitespace are normalised, length is capped", () => {
  assertEquals(cleanText("a\u0000b\nc\t d"), "a b c d");
  const long = cleanText("x".repeat(1000), 50);
  assertEquals(Array.from(long).length, 50);
  assertEquals(long.endsWith("…"), true);
  assertEquals(cleanText(null), "");
  assertEquals(cleanText(42), "");
});

Deno.test("names: JSR and GitHub name shapes", () => {
  assertEquals(isJsrName("plugin-admin"), true);
  assertEquals(isJsrName("dune"), true);
  for (const bad of ["", "Plugin", "a/b", "a b", "a\"b", "-x", "a<b", "x".repeat(101)]) {
    assertEquals(isJsrName(bad), false);
  }
  assertEquals(isGithubName("duneorg"), true);
  assertEquals(isGithubName("plugin-admin.v2_x"), true);
  for (const bad of ["", "..", ".", "a/b", "a b", "a\"b", "a<b"]) assertEquals(isGithubName(bad), false);
});

Deno.test("cleanVersion: only semver survives", () => {
  assertEquals(cleanVersion("3.1.2"), "3.1.2");
  assertEquals(cleanVersion("1.0.0-rc.1"), "1.0.0-rc.1");
  assertEquals(cleanVersion("1.0.0\"><img>"), null);
  assertEquals(cleanVersion(null), null);
});

Deno.test("cleanHttpsUrl: https only, no credentials", () => {
  assertEquals(cleanHttpsUrl("https://jsr.io/@dune/core"), "https://jsr.io/@dune/core");
  for (const bad of ["javascript:alert(1)", "http://example.com", "data:text/html,x", "//x.y", "https://u:p@x.y", "not a url", null]) {
    assertEquals(cleanHttpsUrl(bad), null);
  }
});
