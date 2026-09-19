# Release Notes Template

This file is read by `scripts/release-notes.ts`, which the release workflow runs after a `v*` tag is pushed. Only the text between the two markers is used; everything outside them is documentation for whoever edits the template.

Placeholders are filled from two measured sources and nothing else: the `## [version]` section of `CHANGELOG.md`, and `release-manifest.json` produced by the same workflow run. A placeholder the generator cannot fill aborts the release rather than shipping a note with `{SOMETHING}` in it.

| Placeholder | Filled from |
|---|---|
| `{RELEASE_TITLE}` | the `### ...` headline inside the CHANGELOG section |
| `{CHANGELOG_BODY}` | the rest of that section, carried across whole and never reworded |
| `{VERSION}` | the tag |
| `{PREV_VERSION}` | the previous `## [...]` heading in the CHANGELOG |
| `{NETWORK}` | `network.requestsAndOffersSeed` in the release manifest |
| `{HOLOCHAIN_VERSION}` | `holochainVersion` in the release manifest, read from `hc --version` |

<!-- template:begin -->
## {RELEASE_TITLE}

{CHANGELOG_BODY}

### Installation

**WebApp**: download `requests_and_offers.webhapp` from this release.

**Desktop Apps**:

- **macOS Apple Silicon**: [Download DMG](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-arm64.dmg)
- **macOS Intel**: [Download DMG](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-x64.dmg)
- **Windows**: [Download EXE](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-setup.exe)
- **Linux (Debian/Ubuntu)**: [Download DEB](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron_{VERSION}_amd64.deb)
- **Linux (Universal)**: [Download AppImage](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}.AppImage)

**Homebrew (macOS)**:

```bash
brew tap happenings-community/requests-and-offers
brew install --cask happenings-community/requests-and-offers/requests-and-offers
```

Installing by the full name trusts this cask, which Homebrew 6 and later require. If you installed from a DMG before, quit the app and add `--force`.

**Edge node operators**: `requests_and_offers.happ` and `release-manifest.json` are attached to this release. The manifest carries the version, the network seeds and the artefact digests this release was built with, and `edge-node/health-check.sh --manifest release-manifest.json` verifies a running node against it.

### Technical Specifications

- **Network seed**: `{NETWORK}`
- **Holochain**: {HOLOCHAIN_VERSION}
- **UI**: SvelteKit + Svelte 5
- **Architecture**: 7-layer Effect-TS

---

**Full Changelog**: https://github.com/happenings-community/requests-and-offers/compare/v{PREV_VERSION}...v{VERSION}
<!-- template:end -->
