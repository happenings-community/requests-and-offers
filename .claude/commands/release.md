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
- **`--pre-release`** flag: when present, create a GitHub pre-release (`gh release create --prerelease`), skip the Homebrew formula update step, and label the release with the appropriate pre-release suffix (alpha/beta/rc) based on the current version in `CHANGELOG.md`.
