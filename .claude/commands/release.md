---
description: "Execute the full Requests and Offers hApp release — follows the project release checklist and Holochain packaging workflow."
argument-hint: [version (e.g. v0.2.4)] [--pre-release]
---

# Release

Read `documentation/RELEASE_CHECKLIST.md` as the primary release guide for this project.

Then load and apply the Holochain **PackageAndDeploy** workflow at `~/.claude/skills/Holochain/Workflows/PackageAndDeploy.md` for technical depth on webhapp building, Kangaroo Electron desktop app CI/CD, and semantic versioning.

**Primary guide**: `RELEASE_CHECKLIST.md` — covers pre-release checks, webhapp build, branch sync, GitHub release creation (main repo + kangaroo submodule), Homebrew formula update, and post-release verification.

**Technical complement**: `PackageAndDeploy.md` — Holochain-specific packaging patterns, `bun package` usage, and Kangaroo configuration.

## Arguments

Parse `$ARGUMENTS` for the following:

- **Version** (e.g. `v0.2.4`): use as the target version. If omitted, determine the next version from `CHANGELOG.md` and `dnas/requests_and_offers/dna.yaml`.
- **`--pre-release`** flag: when present, skip the Homebrew formula update step and label the release with the appropriate pre-release suffix (alpha/beta/rc) based on the current version in `CHANGELOG.md`. It no longer flags the GitHub release: the main release, alphas included, is published as a full release marked Latest by `.github/workflows/release.yml` (decided 2026-11-16). "Latest" applies to that release only: the wrapper's desktop release is created as a draft and published by hand once the network's first admin holds the seat.

**The seat, before the tag.** A desktop release runs in development mode, so the first profile created on the new network becomes its admin. The network creator takes that seat from the dry run's install before the tag, and publishes the wrapper's draft release with one `gh release edit` after the tag, once two peers have checked its installers (`RELEASE_CHECKLIST.md`, Production Checks, steps 2 to 5). Do not tag until the creator holds the seat.
