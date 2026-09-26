<!-- markdownlint-disable line-length -->

# Changelog

Repo-level changes that no component changelog covers (CI, branch topology,
developer workflow). User-visible changes belong in the component's own
changelog — `catalog/CHANGELOG.md`, `py-shared/CHANGELOG.md`, `lambdas/*/CHANGELOG.md`.

## Unreleased

- A squashed `dev` -> `master` promote now fails CI and opens an issue, instead of silently freezing the merge base and breaking every later back-merge into `dev`.
