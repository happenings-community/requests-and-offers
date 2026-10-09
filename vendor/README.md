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

Rebuild it from source (the result matches the hash above when the same TypeScript resolves):

```bash
git clone https://github.com/h-REA/hREA && cd hREA && git checkout happ-0.5.0-beta.1
cd modules/vf-graphql-holochain && npm install --ignore-scripts && npm run build
cd build && npm pack
```

Once hREA attaches the tarball to its release (h-REA/hREA, "Attach adapter to a release") the same file can be fetched from `https://github.com/h-REA/hREA/releases/download/happ-0.5.0-beta.1/valueflows-vf-graphql-holochain-0.700.0-rc.0.tgz`; compare its sha256 with the one above before replacing this copy.

**Dropping it.** When `npm view @valueflows/vf-graphql-holochain versions` lists a 0.700 release, set the dependency in `ui/package.json` back to that version range, run `bun install`, commit `bun.lock`, and delete this directory.

The adapter carries upstream the `{ event, resource }` envelope fix that `patches/@valueflows%2Fvf-graphql-holochain@0.600.0-rc.0.patch` applied locally to 0.600, so that patch is gone.
