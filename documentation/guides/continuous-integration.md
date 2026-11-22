# Continuous Integration

The workflows are split by what they cost. The fast checks run on every pull request; the slow suites run when you ask for them.
A separate check, [the zome label check](#the-zome-label-check), watches which zomes a pull request touches.

Before September 2026 this repository had no CI beyond a documentation deploy, so a green pull request proved nothing. That is the gap [#222](https://github.com/happenings-community/requests-and-offers/issues/222) closed.

## What runs on every pull request

`.github/workflows/ci.yml`, on pull requests to `dev` and `main` and on pushes to `dev`.

| Job | Steps | Blocking | Typical time |
|---|---|---|---|
| **Frontend (types, unit, lint)** | `bun run check` (svelte-check), `bun run test:unit`, `bun test scripts/tests` (the release scripts and the zome label check), `bun run lint` | types and tests yes, lint errors no | about a minute |
| **Zomes (unit tests)** | `cargo test --lib --workspace --exclude requests_and_offers_sweettest`, on the host target with plain cargo: no Nix and no wasm | yes | under a minute (37s cold, 15s warm, as measured in the workflow comment) |
| **Zomes (build and pack)** | `bun run download-hrea`, then `bun run build:zomes` and `hc app pack` under Nix | yes | 2 to 3 minutes, faster with a warm cache |

The unit-test job runs the `#[cfg(test)]` modules inside the zome crates. It uses `--workspace`, so a crate that gains its first test module is covered without editing the workflow.
The Sweettest package is excluded because it needs a packed hApp and a conductor; [the heavy suites](#on-a-pull-request-by-label) own it.

Current test counts live in [status.md](../status.md#testing-infrastructure), so they are measured in one place.

### Why the zomes job packs and does not only compile

`hc app pack` validates the DNA and app manifests. A successful `cargo build` says nothing about them, so a manifest broken by a dependency or platform bump would pass a compile-only job.

Note what it does **not** cover, because it is tempting to assume otherwise. The v0.6.0-alpha.1 desktop failure ([#260](https://github.com/happenings-community/requests-and-offers/issues/260)) involved the **webhapp**, which `bun run package` builds and this job does not, and the desktop wrapper's own pinned reader, which lives in another repository. This job would not have caught it. [#261](https://github.com/happenings-community/requests-and-offers/issues/261) carries that check.

### Why lint does not block, and what does

There are 158 pre-existing ESLint errors in a clean checkout, almost all `no-explicit-any` and unused variables, concentrated in `ui/tests/unit/`. None are type errors: `svelte-check` reports zero.

158 is roughly one focused session, not a permanent condition, so treat this tolerance as temporary rather than as policy. It exists so the pipeline could land without a red wall on day one, and it should be removed as soon as someone pays the backlog down.

A warning if you measure this yourself: running `bun run lint` in a working tree that has build output in it (a `test-results/` directory, for instance) reports a much larger number, because ESLint lints those files too. The clean-checkout figure is the one CI sees and the one that matters.

So the step tolerates lint errors and writes the count to the job summary, where the backlog stays visible. It does **not** tolerate a broken linter: ESLint exits `1` when it ran and found problems, and `2` or above when it could not run at all. The second fails the job. Without that split a crashing linter would exit zero and report "0 errors", which reads as good news.

**When the count reaches zero, make it blocking**: delete the step's tolerance of exit 1 in `.github/workflows/ci.yml`.

## Running the heavy suites

`.github/workflows/tests-manual.yml`. Both spin real conductors. Sweettest takes tens of minutes on a developer machine and hours on a hosted runner; the end-to-end suite measured 8m33s in CI on chromium alone, and considerably longer locally when the config adds firefox and webkit. Neither belongs on a per-commit path.

### On a pull request, by label

Add one of these labels to a pull request and the suite runs against that pull request's code, reporting back as a check on it:

| Label | Runs |
|---|---|
| `run:sweettest` | the Rust integration suite |
| `run:e2e` | the Playwright end-to-end suite |
| `run:heavy` | both |

**The label is removed automatically once the run starts**, so re-applying it runs the suite again. This is as close as GitHub Actions gets to GitLab's manual pipeline job: GitHub has no job that waits inside a pipeline for a click, so the click happens on a label instead.

**A check reports the most recent run, including a skipped one.** Both jobs live in one workflow, so labelling `run:e2e` starts the workflow and skips the sweettest job, and the pull request's Sweettest check then reads `skipping` even if an earlier run had it green. This is GitHub's display, not a lost result: the older run keeps its own conclusion on its own page. If you want both checks green on the same commit, label `run:heavy`, or label the second suite once the first finishes.

### On a branch or tag, from the Actions tab

Actions, then **Heavy tests (manual)**, then **Run workflow**. Choose a `suite` of `sweettest`, `e2e` or `both`, and optionally a `ref` to test something other than the branch you selected. Use this before cutting a release.

A `workflow_dispatch` workflow only appears in the Actions tab once its file is on the default branch, so a new one is invisible while its own pull request is open.

### On a release tag

`release.yml` calls **Heavy tests (manual)** through `workflow_call` with `suite: both` before it builds anything, so pushing a `v*` tag runs both suites and a red one stops the release. Dispatching **Release** by hand does the same unless `skip_tests` is ticked. See the [release checklist](../RELEASE_CHECKLIST.md).

Before the suites, a job of a few seconds reads the README's `<!-- release-ready: X.Y.Z -->` marker with `scripts/release-readme.ts` and refuses a tag it does not name, `skip_tests` or not. The marker is raised by hand, by whoever re-read the README for that version; on every pull request, `bun test scripts/tests` also fails while the marker and the `package.json` version disagree, so the version bump pull request is where it moves.

### Sweettest and contention

The sweettest job runs each test case in its own `cargo test` process and passes no thread count at all; see the leak note below for why. Nothing passes `--no-fail-fast` any more either: the per-case loop runs every case whatever the last one did, collects the names of those that failed, and exits non-zero at the end with the list. `fail-fast: false` on the matrix is separate and still live, and is what stops one red binary cancelling the others. These tests wait on real DHT gossip with a 15 second ceiling, so on a loaded machine they fail on the wait rather than on the code. During the v0.6.0-alpha.1 release the same suite went red under contention and green on a quiet machine at 57 passed, 0 failed.

**Sweettest runs as one parallel job per test binary, and that is not premature optimisation.** It was first written as a single job, and the single job does not work. Run 34930626083 ran for 2h13m, passed 28 tests with zero failures, and was killed by `The runner has received a shutdown signal` with two binaries still to go, never reaching its own timeout. A suite that cannot deliver a verdict is not a check.

The reason it is so slow on a runner is the machine, not the tests. A hosted runner has 4 cores against a typical 16 on a developer machine, every test constructs two in-process conductors, and the conductor is linked into the test binary rather than started from a prebuilt one, so the job pays 13m15s to compile 841 crates before a single test runs. The suite takes tens of minutes on a developer machine and hours here.

The matrix trades runner count for wall clock: each leg compiles once and runs one binary, so the suite finishes in roughly the time of its slowest binary rather than the sum of them all. Exactly one leg saves the Rust cache, under a `shared-key` all of them restore from, because one multi-gigabyte cache entry per leg would exhaust the repository's quota. The individual legs report as `Sweettest (<target>)`; the single `Sweettest (Rust integration)` check aggregates them and is the one to require in branch protection.

**Thread count is how this suite starves itself, and the runner said so first.** An early matrix run at `--test-threads 4` lost two legs to `The hosted runner lost communication with the server. Anything in your workflow that terminates the runner process, starves it for CPU/Memory, or blocks its network access can cause this error`, with every test they had executed passing. Each test constructs two or three in-process conductors, so 4 threads is 8 or more conductors on a 4-core runner. That is the starvation, and it also explains individual tests taking over ten minutes in CI against seconds locally: the legs were thrashing rather than working. CI now sidesteps thread count entirely by running one case per process.

**Locally, run tests the way CI does: one case per process.** The old advice here, that 4 threads is right on a 16-core developer machine, is wrong: measured on a 16-core machine, `administration_progenitor` loses cases at that setting and at cargo's default, always to setup timeouts while installing an app rather than to anything the tests assert.

**CI runs each test in its own `cargo test` process, which is a workaround for a real leak.** The suite leaks roughly 620MB per minute across the tests inside a single `cargo test` binary, so on a 16GB runner the two largest binaries exhaust memory and GitHub kills the runner before they finish. This was measured, not guessed: the job samples free memory every 30 seconds and the curve falls in a straight line from 13.6GB to 71MB while disk stays flat at 72G. Running one test per process hands that memory back at every test boundary, and drops the peak to a single test's two conductors. `cargo-nextest` does this natively and was tried first, but its list step could not load `libssl.so.3` from the Nix store, so the loop uses the toolchain that already works in this shell rather than a fetched binary plus an `LD_LIBRARY_PATH` workaround. The leak itself is [#265](https://github.com/happenings-community/requests-and-offers/issues/265) and is still open. Locally more memory hides the leak, but not the setup timeouts: run one case per process, per the paragraph above.

**A target too long for one leg is split into shards.** A leg has 120 minutes, and a case costs three and a half to five and a half minutes on a hosted runner, so a target of more than about 25 cases does not fit: `grants` at 33 was cancelled at the limit with every case it had reached green. It runs as `Sweettest (grants 1/2)` and `Sweettest (grants 2/2)`: the matrix carries a `shard` of `k/n` (`1/1` for every other target), and a leg runs every n-th case starting at the k-th, so between them the legs run each case once and stay even as cases are added. To split another target, take it out of the `target` list and give it `include` entries as `grants` has.

**Adding a `[[test]]` target to `tests/sweettest/Cargo.toml` means adding it to the matrix too.** There is no globbing: a target missing from the matrix simply never runs in CI, silently.

If a sweettest failure says "Consistency not reached", suspect the machine before the code, and re-run it alone.

## The zome label check

`.github/workflows/zome-label-check.yml`, on pull requests to `dev` and `main` (opened, reopened, synchronized, labeled, unlabeled). It runs `scripts/check-zome-labels.ts`.

Only a change to an **integrity** zome alters the DNA hash. A coordinator change does not. A pull request that moves the hash without saying so ships a network reset to every member as a surprise, so the label has to be on the pull request before the merge.

| Changed path | Labels expected |
|---|---|
| `dnas/*/zomes/integrity/**` | `breaking-change` and `zome:integrity` |
| `dnas/*/zomes/coordinator/**` | `zome:coordinator` (a suggestion) |
| anything else | none |

The three labels mean:

- `zome:integrity`: an integrity zome changed, so the DNA hash moves. It always comes with `breaking-change`.
- `zome:coordinator`: a coordinator zome changed and the DNA hash does not move.
- `breaking-change`: the change alters the DNA or a public contract and needs a network reset or a migration.

The check **warns and does not fail**. A missing integrity label produces a warning annotation on the run and a list of the changed paths in the job summary; a missing `zome:coordinator` produces a notice. The decision was a warning, so the check never blocks a merge. It does fail when it cannot read the pull request's file list, for the reason given under lint above: a check that cannot go red when it is blind is not a check. A renamed file counts on both sides, so moving a file out of an integrity zome is still seen.

It has to be `pull_request_target`, and that is safe only because of how it is built:

- It checks out the tip of the default branch (`GITHUB_SHA`, which for `pull_request_target` is the last commit on `dev`) and only the one script, never the pull request's head. The code that runs is always the reviewed code, it always matches the workflow file, and nothing from a fork is built or executed. It does not use the pull request's `base.sha`, which is a snapshot from its last push and, on an older pull request, predates the script.
- The file list comes from the REST API and the labels from the event payload.
- Its token is read-only (`contents` and `pull-requests`), and label names reach the script through an environment variable, not through a shell line.

The consequence is that a `pull_request_target` workflow runs from the default branch, `dev`, for pull requests to `dev` and to `main` alike, so a change to this workflow or script does not take effect on its own pull request. After a change to it, test the logic with `bun test scripts/tests/check-zome-labels.test.ts`, which the Frontend job also runs as part of `bun test scripts/tests`.

To make the warning a failure later, make the script exit non-zero when `verdict.missing` is not empty, then add the check to the required ones in the ruleset.

## Running the same checks locally

```bash
cd ui && bun run check      # svelte-check, also generates SvelteKit types
cd ui && bun run test:unit  # the front-end unit suite, no Nix needed
bun test scripts/tests      # release scripts and the zome label check
cd ui && bun run lint       # expect the known backlog

nix develop --command bun run build:happ   # what the zomes job does
```

`bun run check` runs `svelte-kit sync` first on purpose. That generates `ui/.svelte-kit/tsconfig.json`, which is gitignored, so on a fresh clone `svelte-check` would otherwise fail with "Cannot read file" before reaching any real type error.

## Things worth knowing before changing these files

- **`.github` is no longer blanket-ignored.** It was until September 2026, which silently untracked every workflow added after July 2025. Two paths are still ignored on purpose, the issue and pull-request templates, each commented in `.gitignore`. Check `git status` shows your new workflow before assuming it is committed.
- **`--frozen-lockfile` means the lockfile must match every manifest.** If you change any `package.json`, run `bun install` and commit `bun.lock` in the same commit. Avoid floating specs such as `"latest"`: they drift the lockfile on any contributor's install and then fail an unrelated pull request's frozen check. Never hand-edit `bun.lock`, and never resolve a conflict in it by hand: the file is generated, so take either side and re-run `bun install` to regenerate it. A hand-merged lockfile passes review and then fails `--frozen-lockfile` on a change nobody connects to it.
- **No vendored tarballs.** Every dependency installs from the registry. If one ever has to be vendored again as a `file:` tarball, gate it with a `sha256sum -c` step before install: bun checks a `file:` tarball against its `bun.lock` sha512 only on a cold cache, so a tampered tarball installs silently from a warm one. The hREA adapter was vendored that way until `0.700.0-rc.0` reached npm (h-REA/hREA#412).
- **The zomes job installs no JavaScript.** `build:happ` is cargo plus `hc`, and `download-hrea` is a dependency-free bun script that checks the pinned sha256. Adding a `bun install` there couples a Rust job to the JS lockfile for no benefit.
- **Nix comes from the public `holochain-ci` Cachix cache**, read-only, so no token is needed.
- **Branch rules live in a ruleset, so the classic API lies about them.** `gh api repos/:owner/:repo/branches/dev/protection` returns 404 for a branch that is protected, because rulesets are not classic branch protection and never appear at that endpoint. Read `gh api repos/:owner/:repo/rules/branches/dev` for what actually applies to a branch, and `gh api repos/:owner/:repo/rulesets` for the rulesets themselves. The branch object's `protected: true` is the only honest signal the older endpoints give.

## What CI still does not cover

- **No check is required to merge.** `dev` is protected against deletion and force push by ruleset `2344243` and by nothing else, so a red check does not block a merge. Making one required is a repository setting, not a workflow line. See [Contributing](contributing.md#branch-protection).
- **The desktop packaging path is checked only at release time.** `release.yml` refuses to publish when the wrapper's bundled conductor is on a different Holochain line from the hApp, the check that would have stopped [#260](https://github.com/happenings-community/requests-and-offers/issues/260). Nothing runs it on a pull request, and the installers themselves are only built by the wrapper after a release ([#261](https://github.com/happenings-community/requests-and-offers/issues/261)).
