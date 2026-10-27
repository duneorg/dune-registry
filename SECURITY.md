# Security policy

## Reporting a vulnerability

Please report security problems **privately**, not through a public issue, pull
request, discussion or branch.

Use GitHub's private reporting: open this repository's **Security** tab and
choose **Report a vulnerability**. That opens a confidential advisory that only
you and the maintainers can see.

## What is in scope

This repository holds the data behind the plugin and theme library on
getdune.org (`plugins.json`, `themes.json`) and the scheduled job that builds
it from JSR. Things worth reporting:

- a way for a package listed here to put content into the data that could
  cause harm where it is displayed (markup or script in a description or name,
  unsafe links),
- a way to get a package listed as first-party or verified that isn't,
- a way to change a package's name, version or install command in the data
  without owning the package,
- a problem in the refresh workflow that would let someone change what the
  job writes or where it writes it.

Include the data or package involved and how you reproduced it. You don't need
a complete write-up or a fix.

## What to expect

We read every report, confirm whether it is a vulnerability, and work on a fix
privately. Details are kept out of public commits, branches and release notes
until a fix is in place. We credit the reporter if they want that.

## Not security issues

A wrong or missing listing, a stale entry, or a request to add or remove a
package belongs in the regular issue tracker.
