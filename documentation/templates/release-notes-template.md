# Release Notes Template

> This template matches the format used in v0.3.0 and v0.4.0 releases.
> Replace all `{PLACEHOLDERS}` before publishing.

---

## {RELEASE_TITLE}

### What's New

#### Features
{FEATURES_LIST}

#### Bug Fixes
{BUGFIXES_LIST}

#### Known Issues
{KNOWN_ISSUES}

See [CHANGELOG.md](CHANGELOG.md) for full details.

### Installation

**WebApp**:
Download `requests_and_offers.webhapp` from this release

**Desktop Apps**:
- **macOS Apple Silicon**: [Download DMG](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-arm64.dmg)
- **macOS Intel**: [Download DMG](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-x64.dmg)
- **Windows**: [Download EXE](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-setup.exe)
- **Linux (Debian/Ubuntu)**: [Download DEB](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron_{VERSION}_amd64.deb)
- **Linux (Universal)**: [Download AppImage](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}.AppImage)

**Homebrew (macOS)**:
```bash
brew tap happenings-community/homebrew-requests-and-offers
brew install --cask requests-and-offers
```

### Technical Specifications
- **Network**: {NETWORK}
- **Holochain Version**: {HOLOCHAIN_VERSION}
- **UI Framework**: SvelteKit + Svelte 5
- **Architecture**: 7-Layer Effect-TS

---

**Full Changelog**: https://github.com/happenings-community/requests-and-offers/compare/v{PREV_VERSION}...v{VERSION}

---

## Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `{VERSION}` | Release version number | `0.4.0` |
| `{PREV_VERSION}` | Previous release version | `0.3.0` |
| `{RELEASE_TITLE}` | Release headline with emoji | `🚀 Weave/Moss Integration & Markdown Support Release` |
| `{FEATURES_LIST}` | Feature bullet points from CHANGELOG | `- **Feature Name**: Description` |
| `{BUGFIXES_LIST}` | Bug fix bullet points from CHANGELOG | `- **Fix Name**: Description` |
| `{KNOWN_ISSUES}` | Known issues or "None" | `- **hREA**: Outstanding issues...` |
| `{NETWORK}` | Bootstrap/signal network used | `dev-test-bootstrap2.holochain.org` |
| `{HOLOCHAIN_VERSION}` | Holochain framework version | `0.6.0` |

## Usage

```bash
# 1. Copy template content (everything between the --- markers above)
# 2. Replace {VERSION} globally
# 3. Fill in features/bugfixes from CHANGELOG.md
# 4. Apply to GitHub release:
gh release edit v{VERSION} --notes "$(cat /tmp/release-notes.md)"
```

The download URL pattern is consistent across releases — only `{VERSION}` changes in the links.
