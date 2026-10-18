# Vendored packages

## `@valueflows/vf-graphql-holochain` 0.700.0-rc.0

The hREA GraphQL adapter that pairs with hREA `happ-0.5.0-beta.1` (Holochain 0.7, `@holochain/client` ^0.21). npm still serves `0.600.0-rc.0`, the 0.6 line, so the UI installs this tarball through a `file:` dependency in `ui/package.json` instead (#316, upstream h-REA/hREA#412).

| | |
|---|---|
| File | `valueflows-vf-graphql-holochain-0.700.0-rc.0.tgz` |
| sha256 | `e64163912e87ca2271660806c263e95c8208dfd99a660042bfee5764fba3d2fe` (also in the `.sha256` file beside it) |
| Source | h-REA/hREA tag `happ-0.5.0-beta.1`, commit `79c8d4fb98c4f7f9a8cf3f7dd69690d6d1334d85`, `modules/vf-graphql-holochain` |
| Built with | node 24.13.0, npm 11.6.2, TypeScript as resolved by the module's `^5.3.3`; hREA's `scripts/verify-purpose-schema.mjs` passed against the build |

Check it:

```bash
cd vendor && sha256sum -c valueflows-vf-graphql-holochain-0.700.0-rc.0.tgz.sha256
```

CI runs that check before `bun install`. bun does compare a `file:` tarball with its `bun.lock` sha512, but only when the tarball is not already in its cache: on a cold cache a tampered file fails with `IntegrityCheckFailed`, on a warm one bun exits 0 and installs the cached original. The sha256 gate gives the same answer whatever the cache holds, and fails before install with the file named.

Rebuild it from source. The module cannot be built inside a full hREA checkout with npm: npm 11 resolves the yarn workspace there and stops with `EUNSUPPORTEDPROTOCOL` on the `link:` dependency in `clients/acceptance`. Extract the module out of the workspace first, in a scratch directory:

```bash
git clone --depth 1 --branch happ-0.5.0-beta.1 https://github.com/h-REA/hREA hREA-src
git -C hREA-src rev-parse HEAD
mkdir adapter-src
git -C hREA-src archive happ-0.5.0-beta.1 modules/vf-graphql-holochain | tar -x -C adapter-src
cd adapter-src/modules/vf-graphql-holochain
npm install --ignore-scripts
npm run build
cd build && npm pack
gzip -dc valueflows-vf-graphql-holochain-0.700.0-rc.0.tgz | sha256sum
```

`rev-parse` prints `79c8d4fb98c4f7f9a8cf3f7dd69690d6d1334d85`. Compare the last line with the sha256 of the uncompressed tar stream of the vendored file, not with the sha256 of the `.tgz`:

```bash
gzip -dc vendor/valueflows-vf-graphql-holochain-0.700.0-rc.0.tgz | sha256sum
# fac8a221f0a4c07d643ff43068cf48e8391cad09285c36ea4eb843d1f1d0f00d
```

The tar stream is what reproduces. The gzip layer depends on the node and npm doing the packing, so a rebuild with identical contents can give a different `.tgz` sha256; the `.tgz` sha256 above matched only on node 24.13.0 with npm 11.6.2. Note that the module's `build` script is `tsc; node ./finish-build`, so a type error still emits JavaScript and exits 0: read the `tsc` output.

The intended path is hREA's own `scripts/pack-adapter.sh` (h-REA/hREA#421, a draft, not merged), which type-checks, builds, runs the schema check, packs, and writes the `.sha256`. It packs another checkout, such as this tag, with `HREA_ROOT=<checkout> scripts/pack-adapter.sh [out-dir]`, and expects that checkout's workspace dependencies installed with `yarn install`.

Once hREA attaches the tarball to its release (h-REA/hREA, "Attach adapter to a release") the same file can be fetched from `https://github.com/h-REA/hREA/releases/download/happ-0.5.0-beta.1/valueflows-vf-graphql-holochain-0.700.0-rc.0.tgz`; compare its tar-stream sha256 (`gzip -dc <file> | sha256sum`) with `fac8a221...` above before replacing this copy, since a release built on another node and npm can differ in the gzip layer alone.

**Dropping it.** When `npm view @valueflows/vf-graphql-holochain versions` lists a 0.700 release, set the dependency in `ui/package.json` back to that version range, run `bun install`, commit `bun.lock`, and delete this directory.

The adapter carries upstream the `{ event, resource }` envelope fix that `patches/@valueflows%2Fvf-graphql-holochain@0.600.0-rc.0.patch` applied locally to 0.600, so that patch is gone.
