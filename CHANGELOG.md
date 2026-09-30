<!-- markdownlint-disable line-length -->

# Changelog

Repo-level changes that no component changelog covers (CI, branch topology,
developer workflow). User-visible changes belong in the component's own
changelog — `catalog/CHANGELOG.md`, `py-shared/CHANGELOG.md`, `lambdas/*/CHANGELOG.md`.

## Unreleased

- Setting the `REBUILD_DEV_ENABLED` repo variable rebuilds `dev` as master plus the open PRs labelled `dev-preview`, so contributors preview on dev.quilttest.com without a separate dev PR; anything else on `dev` is dropped.
- A squashed `dev` -> `master` promote now fails CI and opens an issue, instead of silently freezing the merge base and breaking every later back-merge into `dev`.
