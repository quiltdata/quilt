<!-- markdownlint-disable line-length -->

# Changelog

Repo-level changes that no component changelog covers (CI, branch topology,
developer workflow). User-visible changes belong in the component's own
changelog — `catalog/CHANGELOG.md`, `py-shared/CHANGELOG.md`, `lambdas/*/CHANGELOG.md`.

## Unreleased

- A manual deploy run from any ref but `master` or `dev` publishes its lambda zips and images as `dev-<sha>` instead of under the bare sha that `master` and `dev` builds use.
- Setting the `REBUILD_DEV_ENABLED` repo variable rebuilds `dev` as master plus every open PR labelled `dev-preview` (stacked PRs included), so a contributor previews on dev.quilttest.com without a dev PR; anything else on `dev` is dropped.
- Deployment is told as soon as a `dev` commit's images finish building, so dev.quilttest.com pins them in minutes instead of on the next hourly poll ([#5352](https://github.com/quiltdata/quilt/pull/5352)).
- A squashed `dev` -> `master` promote now fails CI and opens an issue, instead of silently freezing the merge base and breaking every later back-merge into `dev`.
