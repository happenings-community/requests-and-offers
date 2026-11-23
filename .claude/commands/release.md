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

**The seat, before the tag.** A release is keyed: the repository variable `PROGENITOR_PUBKEY` holds the steward node's key, the release writes it into `workdir/happ.yaml`, and the release refuses to build without it (#600). The steward installs the release and creates its profile, each team member installs the desktop build and creates a profile, and the steward grants them administrator (`documentation/progenitor.md`, Release builds). The wrapper's draft release is published with one `gh release edit` after the tag, once two peers have checked its installers (`RELEASE_CHECKLIST.md`, Production Checks). Do not tag until `PROGENITOR_PUBKEY` is set.
