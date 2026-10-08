# Project Board Automation

The [project board](https://github.com/orgs/happenings-community/projects/2) is moved by hand except for one transition, which a workflow makes when a pull request merges.

## `Closes #N` and `Impl #N`

A pull request body names the issues it touches with one of two markers.

| Marker | Use it when | What happens on merge |
|---|---|---|
| `Closes #N` | The pull request fully resolves the issue, tests and documentation included | GitHub closes the issue and the board moves it to **Done** |
| `Impl #N` | The code landed but the issue still needs its tests or documentation | The issue stays open and moves to **In Review** |

**In Review** is the board's option for "PR open, awaiting review, tests or docs", which is the state an `Impl` issue is in once its code has merged. Close the issue with a later `Closes #N` once the remaining work lands.

The marker is matched case-insensitively and tolerates a missing space, so `Impl #248`, `impl#248` and `IMPL #248` all count. Several markers in one body move several issues. A marker naming a pull request, or an issue that does not exist, is skipped rather than failing the run. A marker naming a closed issue is skipped too, so quoting an old issue in a body never pulls its card back out of **Done**. Any other lookup error (a rate limit, a network failure, a token without access) fails the run instead of being read as a missing issue.

## The workflow

`.github/workflows/impl-issue-status.yml` runs on every merged pull request. It parses the body for `Impl` markers, looks each issue up through its own project items, and sets the Status field to **In Review** on board #2. A merged pull request with no marker finishes green without touching the board.

It needs a repository secret, `PROJECT_TOKEN`: a personal access token with `project` (read and write) and `repo` (read) scopes. The default `GITHUB_TOKEN` cannot write to an organisation project. Without the secret the move step fails and says so in its log.

Pull requests from forks do not receive repository secrets, so a merged fork pull request carrying an `Impl` marker will fail the move step. Move that issue by hand.

## Changing the target column

The workflow matches the Status option by name, in `STATUS_OPTION_NAME`. Renaming or removing **In Review** on the board breaks it, and the run's log then lists the options that do exist. Check the live list before changing either side:

```bash
gh api graphql -f query='query { node(id:"PVT_kwDOCWVvHs4AlCJe"){ ... on ProjectV2 { field(name:"Status"){ ... on ProjectV2SingleSelectField { options { id name } } } } } }'
```

## History

The workflow existed on a maintainer's disk long before it ever ran: `.gitignore` ignored all of `.github` from July 2025 until September 2026, and when that was narrowed the file stayed ignored because it targeted a "Tests and Documentation" option the board does not have. Issue #254 committed it with the correct option and two further fixes: the parse step failed on any merged pull request without a marker, and the issue lookup scanned only the first 100 board items, which missed every recent issue once the board grew past that.
