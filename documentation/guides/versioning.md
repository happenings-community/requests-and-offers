# Versioning

Agreed at the dev meeting of 20 October 2026. This is the rule the release checklist and the release chain follow when choosing the next version.

## Before 1.0

| Change | Bump | Example |
|---|---|---|
| Breaking: a DNA change that alters the DNA hash, so the release starts a new network | **minor** | `0.6.3` to `0.7.0` |
| Anything else: UI, fixes, docs, a zome change that keeps the DNA hash | **patch** | `0.6.3` to `0.6.4` |

Breaking changes are **batched**: several DNA changes waiting for release go out together in one minor, so testers go through one network reset rather than several.

A release is breaking when its DNA hash differs from the previous release's. Integrity zome code, entry and link types, DNA properties and the network seed all change it; a coordinator-only change does not. When in doubt, compare the `dna.hash` field of the two release manifests.

## Pre-releases

An `-alpha.N` or `-beta.N` pre-release carries the version it leads to. Until `v0.6.0`, the networks are internal test networks: a pre-release may break the one before it (`0.6.0-alpha.1` to `0.6.0-alpha.2`), test data is recreated, and each DNA change costs one network reset, announced before it happens.

On the desktop, each pre-release installs in its own data folder, keystore included ([kangaroo #10](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/pull/10)), so every pre-release starts with a new agent key. Give every pre-release a new network seed as well: a pre-release that kept the previous seed would put testers on the old network under new keys, their profiles orphaned. How a fix that keeps the DNA ships during the alpha line is not settled yet.

## After 1.0

Standard [Semantic Versioning](https://semver.org/spec/v2.0.0.html): **major** for a breaking change, minor for a compatible feature, patch for a fix. From then on a breaking change also needs a data migration path, which is [#144](https://github.com/happenings-community/requests-and-offers/issues/144).

## Why minor before 1.0

Semantic Versioning leaves `0.x` open, and the common reading is the one used here: the minor is the breaking number. The desktop wrapper reads it the same way. Kangaroo's `breakingVersion()` gives `0.6.x` and `0.7.x` separate data folders, so a breaking minor installs beside the previous release rather than over it, while a patch upgrades in place.
