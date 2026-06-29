# Contributing to Quilt

Thanks for your interest in contributing to Quilt! Quilt is an open-source
scientific data management platform, and we genuinely welcome contributions from
the community — bug reports, feature ideas, docs fixes, and code.

This page is the front door. For the detailed development setup, testing, and
release mechanics, see [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Where to ask questions

- **Questions / discussion / "is this a bug?":** join the
  [Quilt Slack community](https://slack.quilt.bio).
- **Bugs:** file a [GitHub issue](https://github.com/quiltdata/quilt/issues).
- **Feature ideas:** file a feature request (see below) before writing a large
  change.

All participation is governed by our
[Code of Conduct](docs/CODE_OF_CONDUCT.md). Please read it. Reports can be sent
to `dev@quiltdata.io`.

## How we take in new work: file a request first

For anything beyond a small, self-contained fix, **open an issue before you open
a pull request.** This is the fastest path to getting your contribution merged,
and it saves you from investing effort in a change we can't accept as-is.

Why we ask for this:

- **Alignment up front.** A short discussion on an issue lets us confirm the
  problem is one we want to solve and agree on the shape of the solution before
  you write code.
- **We turn accepted requests into an internal spec.** When the core team
  accepts a feature request, we write up the design and acceptance criteria on
  our side, and implementation follows from there. You do **not** need access to
  any internal spec corpus to contribute — the GitHub issue is the shared
  contract between you and the maintainers. Work the issue, and we'll handle the
  internal planning.
- **Less wasted work.** Large unsolicited PRs are hard to review and often
  conflict with work already in flight.

Good feature requests describe the *problem* and the *use case* first, and the
proposed solution second. Screenshots, sample data, and reproduction steps all
help. See [What a good feature request looks like](#what-a-good-feature-request-looks-like)
for a concrete checklist.

When you open an issue, pick the matching template:

- **[Feature request](.github/ISSUE_TEMPLATE/feature_request.yml)** — propose a
  new capability or enhancement. File this *before* writing a large change.
- **[Bug report](.github/ISSUE_TEMPLATE/bug_report.yml)** — report something
  that's broken, with reproduction steps.
- **[Documentation issue](.github/ISSUE_TEMPLATE/documentation.yml)** — report
  missing, unclear, or incorrect docs.

These are structured forms: filling in the fields is what lets a maintainer turn
your request into accepted, well-scoped work quickly. General questions and
"is this a bug?" discussions belong in the
[Quilt Slack community](https://slack.quilt.bio), not in an issue.

## What a good feature request looks like

A well-formed feature request leads with the *problem*, not the *patch*. The
strongest requests we get follow the same shape our own engineers use
internally, so the more of this you can fill in, the faster we can say "yes" and
scope the work. The [feature request form](.github/ISSUE_TEMPLATE/feature_request.yml)
walks you through it; here's the checklist:

- **Problem / motivation.** What's missing or painful today, what the current
  behavior or workaround is, who is affected, and what it costs them. A
  user-story framing works well: *"As a [Catalog admin / quilt3 user] I want
  [capability] so that [benefit]; today [current behavior], which means
  [impact]."*
- **Proposed solution.** How you'd like it to work — the behavior or API you'd
  expect. You don't need to know the implementation; focus on the outcome.
- **Alternatives considered.** Other approaches you weighed and why you ruled
  them out. If there are a few viable options with trade-offs, name them — that
  helps us pick a direction faster.
- **Acceptance criteria / definition of done.** The observable behaviors that
  must be true for this to be "done," plus any hard rules or invariants that
  must *not* be broken (for example, "must not expose data the user isn't
  entitled to see").
- **Scope & non-goals.** What's explicitly in scope and, just as importantly,
  what's out. Calling out non-goals keeps the change reviewable.
- **References.** Screenshots, sample data, related issues/PRs, or external docs.

You don't have to fill in every section perfectly — a clear problem statement
and use case is the one part we really need. We'll work the rest out with you on
the issue. (Internally, the core team adds its own triage and ownership fields
when it accepts a request; you don't need to touch those.)

## Small fixes are always welcome

You don't need to file an issue first for small, low-risk changes — typo fixes,
docs clarifications, obvious one-line bug fixes. Use judgment: if the change is
big, changes behavior, or touches shared interfaces, start with an issue.

## Code contribution workflow

1. **Fork** the repo (or branch directly if you're a maintainer).
2. **Clone** and create a topic branch:

   ```bash
   git clone https://github.com/quiltdata/quilt
   cd quilt
   git checkout -b my-change
   ```

3. **Make your change** in the relevant area. The
   [README repository map](README.md) shows where each component lives; the
   short version:
   - `api/python` — `quilt3` Python SDK and CLI
   - `catalog` — web catalog frontend (TypeScript/JavaScript)
   - `lambdas` — AWS Lambda services
   - `docs` — product, platform, and contributor documentation
4. **Add tests** (see [Testing](#testing-and-quality-checks) below) and make
   sure existing tests pass.
5. **Open a pull request** against `master`. Fill out the
   [pull request template](.github/pull_request_template.md) — it includes a
   checklist for tests, docs, changelog, and the security/Open-variant impact of
   your change.
6. **Reference the issue** your PR addresses (e.g. "Closes #123").

### Commit and PR conventions

- Keep PRs focused: one logical change per PR. Smaller PRs get reviewed faster.
- Write clear commit messages that explain *why*, not just *what*.
- Update [`docs/CHANGELOG.md`](docs/CHANGELOG.md) when your change is meaningful
  to end users (docs-only changes can skip this).
- Keep documentation in sync with behavior changes — the PR template lists the
  doc surfaces to check.

## Infrastructure and deployment changes are owned by the core team

**Please do not bundle infrastructure, deployment, or CI/CD changes into a
feature or bug-fix PR.** This includes (non-exhaustively): CloudFormation /
deployment templates, IAM and other AWS resource configuration, CI workflow
changes under `.github/workflows/`, release tooling, and anything that changes
how Quilt is built, packaged, or deployed.

These surfaces are tightly coupled to Quilt's internal release and enterprise
deployment process, and changes to them carry operational and security risk that
the core team needs to own and sequence. A change that looks self-contained from
the outside can break enterprise deployments in ways that aren't visible from
the public repo.

If you believe an infrastructure change is needed:

- **Open an issue describing the problem**, not a PR with the fix. Explain what
  you're trying to achieve and why the current setup blocks you.
- The core team will evaluate it, and either take it on or work with you on the
  right approach.

Keeping infrastructure out of feature PRs keeps your contribution reviewable and
mergeable, and keeps deployment changes on a controlled path.

## Setting up a local dev environment

Detailed, component-by-component setup lives in
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md). In brief:

- **Python SDK / CLI (`api/python`):** we use [`uv`](https://github.com/astral-sh/uv)
  for dependency management. Install `uv`, then `uv run poe test` runs the test
  suite. Run `uv run poe` to list all tasks. This path works fully locally.
- **Catalog frontend (`catalog`):** `npm install`, then `npm start` for a
  live-reloading dev server, `npm run build` for a static bundle.

### Do you actually need a running stack?

For most contributions, **no.** Be honest with yourself about what your change
needs:

- **Filing a feature request or bug report:** no stack required. Just open an
  issue.
- **Docs fixes, and small or self-contained code changes:** no stack required.
  Many parts of the codebase can be developed and tested in isolation — the
  Python SDK/CLI (`api/python`) runs and tests fully locally (`uv run poe
  test`), and the catalog frontend (`catalog`) builds and runs its unit tests
  locally (`npm run build`, `npm run test`).
- **Substantial catalog or lambda changes that need live backend services:**
  these do need a deployed stack to exercise end-to-end. The catalog depends on
  services (AWS Lambda, Elasticsearch/OpenSearch) that don't run standalone, so
  a local catalog expects a Quilt stack already deployed to AWS. The
  component-by-component setup for this path is documented in
  [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

If your change needs end-to-end validation against backend services and you
can't deploy a stack, say so in your issue or PR: open the issue first, describe
what you've verified locally (unit tests, local catalog/CLI behavior), and a
maintainer will help validate the change against an internal stack during
review. We'd rather review a focused change you've tested as far as you can
locally than have you blocked on infrastructure.

## Testing and quality checks

- **All new code is expected to ship with tests** and to pass the existing
  suite.
- **Python (`api/python`):** `uv run poe test` (and `test-verbose`, `test-cov`).
- **Catalog (`catalog`):** `npm run test`.
- Linting and formatting are configured in-repo (for example, `ruff` for Python
  and the catalog's lint/format tooling). Run the project's lint tasks before
  opening a PR so CI passes on the first try; `uv run poe` lists the available
  Python tasks, and the catalog's scripts are defined in `catalog/package.json`.

## Code of Conduct

This project follows the [Contributor Covenant](docs/CODE_OF_CONDUCT.md). By
participating, you agree to uphold it. Report unacceptable behavior to
`dev@quiltdata.io`.

## License and contributor terms

Quilt is open source under the
[Apache License, Version 2.0](LICENSE). By contributing, you agree that your
contributions are licensed under the same terms (Apache-2.0 inbound = outbound,
per section 5 of the license).
