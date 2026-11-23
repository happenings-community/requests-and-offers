---
name: Dogfood Network
description: This skill should be used when building desktop installers of a branch or PR for a dogfooding session on a throwaway network, replacing the dogfood pre-release on the Kangaroo wrapper repository, running the fresh-device joiner check before a release, or cleaning up test builds once dogfooding is over
---

# Dogfood Network

A dogfood build is the real desktop app, built from any branch of this repository, on a network seed nobody else uses.
It never touches the release network, and the updater of an installed release never sees it.

## What done looks like

- One test pre-release on `happenings-community/requests-and-offers-kangaroo-electron`, tagged `test-v<version>-dryrun-…`, with installers for Linux (AppImage, deb), macOS (arm64, x64) and Windows, and a `SHA256SUMS.txt`.
- Its webhapp is the one built from the branch under test, and its sha256 is the one printed when it was packed.
- Its network seed is a throwaway seed, `alpha2-dogfood-<YYYY-MM-DD>` style, never the seed in the wrapper's `main` or `release`.
- The previous dogfood pre-release is gone: there is only ever one, and it is replaced at each new build.
- When dogfooding is over, every test pre-release and every hosting release is deleted, so only real releases remain.

## The pieces

**The webhapp.** Packed from a worktree of the branch under test:

```bash
env -u CARGO_TARGET_DIR nix develop --command bun run package
sha256sum workdir/requests_and_offers.webhapp
```

`CARGO_TARGET_DIR` must be unset: the Sweettest target dir (`target/native-tests`) makes `hc` pack the previous wasm, silently.
`bun run package` runs `build:happ`, the UI package with mock buttons off, and `hc web-app pack`.

**The throwaway network.** A branch of the wrapper repository, `dogfood/<slug>-<YYYY-MM-DD>`, cut from the wrapper's `main`, whose only change is `networkSeed` in `kangaroo.config.ts`.
It is a test branch and is never merged; its commit message says so.

**Hosting the webhapp.** `test-installers` takes either a hApp Release dry-run run id or an https URL.
A branch that is not a dry run uses the URL: upload the webhapp to a hosting pre-release on the wrapper repository, tagged `test-webhapp-<slug>-<YYYY-MM-DD>` (not semver, so the updater ignores it), with `--prerelease --latest=false`, and check that the downloaded file has the same sha256.

**The installers.**

```bash
gh workflow run test-installers.yaml \
  --repo happenings-community/requests-and-offers-kangaroo-electron \
  --ref dogfood/<slug>-<YYYY-MM-DD> \
  -f webhapp_url=<URL> -f webhapp_sha256=<SHA256> -f webhapp_seed=<SEED>
```

The workflow refuses a seed that differs from the branch's `kangaroo.config.ts`, builds all four platforms, and publishes only if all four succeed (about seven minutes).
Its tag ends in the first twelve hex characters of the webhapp's sha256, so a new webhapp makes a new pre-release: the old one is not updated, it is deleted once the new one is published and checked (Soushi's standing rule, 23 November 2026).

## The session

- One person takes the administrator seat first.
  On a keyless build that is the first profile with "I am creating this network" ticked; on a keyed build it is the steward (`documentation/progenitor.md`).
- **The joiner check, every release** (`documentation/RELEASE_CHECKLIST.md`): a second person installs on a fresh device, creates a profile without ticking anything, and must be a pending member, never an administrator, even with a poor connection.
  The 22 November rehearsal failed this check (#600).
- Findings go to Field Notes or issues, each with a test once fixed.

## Cleanup

Deleting a release is outward-facing: Soushi authorised replacing the dogfood pre-release at each build and deleting all test builds when dogfooding is over; anything else asks first.

```bash
gh release delete <test-tag> --cleanup-tag --yes \
  --repo happenings-community/requests-and-offers-kangaroo-electron
```

The `dogfood/*` wrapper branches are left in place unless Soushi asks for them to go.

## Gotchas

- A dogfood build has the same version as the real release.
  Testers uninstall it and reinstall the real release when done, and each pre-release gets its own data folder (wrapper README).
- A build from a branch with integrity or `utils` changes has a different DNA hash: nothing created on an earlier dogfood network carries over, and everyone reinstalls.
- Installers are not signed; the release notes carry the macOS quarantine command.
