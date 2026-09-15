# Continuous Integration

Two workflows, split by what they cost. The fast checks run on every pull request; the slow suites run when you ask for them.

Before September 2026 this repository had no CI beyond a documentation deploy, so a green pull request proved nothing. That is the gap [#222](https://github.com/happenings-community/requests-and-offers/issues/222) closed.

## What runs on every pull request

`.github/workflows/ci.yml`, on pull requests to `dev` and `main` and on pushes to `dev`.

| Job | Steps | Blocking | Typical time |
|---|---|---|---|
| **Frontend** | `bun run check` (svelte-check), `bun run test:unit` (556 tests), `bun run lint` | types and tests yes, lint errors no | about a minute |
| **Zomes** | `bun run download-hrea`, then `bun run build:zomes` and `hc app pack` under Nix | yes | 2 to 3 minutes, faster with a warm cache |

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

`.github/workflows/tests-manual.yml`. Both spin real conductors. Sweettest takes about 15 minutes across 14 test binaries on a developer machine and hours on a hosted runner; the end-to-end suite measured 8m33s in CI on chromium alone, and considerably longer locally when the config adds firefox and webkit. Neither belongs on a per-commit path.

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

### Sweettest and contention

The sweettest job runs with `--test-threads 4` and `--no-fail-fast`, and both matter. These tests wait on real DHT gossip with a 15 second ceiling, so on a loaded machine they fail on the wait rather than on the code. During the v0.6.0-alpha.1 release the same suite went red under contention and green on a quiet machine at 57 passed, 0 failed. `--no-fail-fast` stops one flaky binary hiding the other thirteen.

**Sweettest runs as fourteen parallel jobs, one per test binary, and that is not premature optimisation.** It was first written as a single job, and the single job does not work. Run 34930626083 ran for 2h13m, passed 28 tests with zero failures, and was killed by `The runner has received a shutdown signal` with two binaries still to go, never reaching its own timeout. A suite that cannot deliver a verdict is not a check.

The reason it is so slow on a runner is the machine, not the tests. A hosted runner has 4 cores against a typical 16 on a developer machine, every test constructs two in-process conductors, and the conductor is linked into the test binary rather than started from a prebuilt one, so the job pays 13m15s to compile 841 crates before a single test runs. The suite takes about 15 minutes locally and hours here.

The matrix trades runner count for wall clock: each leg compiles once and runs one binary, so the suite finishes in roughly the time of its slowest binary rather than the sum of all fourteen. Exactly one leg saves the Rust cache, under a `shared-key` all of them restore from, because fourteen multi-gigabyte cache entries would exhaust the repository's quota. The individual legs report as `Sweettest (<target>)`; the single `Sweettest (Rust integration)` check aggregates them and is the one to require in branch protection.

**Adding a `[[test]]` target to `tests/sweettest/Cargo.toml` means adding it to the matrix too.** There is no globbing: a target missing from the matrix simply never runs in CI, silently.

If a sweettest failure says "Consistency not reached", suspect the machine before the code, and re-run it alone.

## Running the same checks locally

```bash
cd ui && bun run check      # svelte-check, also generates SvelteKit types
cd ui && bun run test:unit  # 556 unit tests, no Nix needed
cd ui && bun run lint       # expect the known backlog

nix develop --command bun run build:happ   # what the zomes job does
```

`bun run check` runs `svelte-kit sync` first on purpose. That generates `ui/.svelte-kit/tsconfig.json`, which is gitignored, so on a fresh clone `svelte-check` would otherwise fail with "Cannot read file" before reaching any real type error.

## Things worth knowing before changing these files

- **`.github` is no longer blanket-ignored.** It was until September 2026, which silently untracked every workflow added after July 2025. Three paths are still ignored on purpose, each commented in `.gitignore`. Check `git status` shows your new workflow before assuming it is committed.
- **`--frozen-lockfile` means the lockfile must match every manifest.** If you change any `package.json`, run `bun install` and commit `bun.lock` in the same commit. Avoid floating specs such as `"latest"`: they drift the lockfile on any contributor's install and then fail an unrelated pull request's frozen check.
- **The zomes job installs no JavaScript.** `build:happ` is cargo plus `hc`, and `download-hrea` is curl. Adding a `bun install` there couples a Rust job to the JS lockfile for no benefit.
- **Nix comes from the public `holochain-ci` Cachix cache**, read-only, so no token is needed.

## What CI still does not cover

- **Branch protection is not configured.** A red check does not yet block a merge; that is a repository setting, not a workflow line.
- **Nothing checks the desktop packaging path.** The wrapper's bundled conductor and the hApp's Holochain version are paired only at release time, which is how [#260](https://github.com/happenings-community/requests-and-offers/issues/260) reached a release. [#261](https://github.com/happenings-community/requests-and-offers/issues/261) carries the check for the 0.7 upgrade.
