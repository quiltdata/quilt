<!-- markdownlint-disable line-length -->
# Changelog

Changes are listed in reverse chronological order (newer entries at the top).
The entry format is

```markdown
- [Verb] Change description ([#<PR-number>](https://github.com/quiltdata/quilt/pull/<PR-number>))
```

where verb is one of

- Removed
- Added
- Fixed
- Changed

## Changes

- [Added] Per-user package access counts, written to `UserAccessCounts/Users.csv`. The persistent `ObjectAccessLog` gains a `username` column derived from the CloudTrail principal. Kept out of `AccessCounts/` because public stacks may grant anonymous reads there; consumers must add an admin-only read policy for the new prefix ([#4952](https://github.com/quiltdata/quilt/pull/4952))
- [Added] Track the `ObjectAccessLog` schema version and rebuild existing partitions from the earliest available CloudTrail logs when it changes, instead of only backfilling one year on a first run ([#4952](https://github.com/quiltdata/quilt/pull/4952))
- [Added] Run Athena queries in a dedicated workgroup whose configuration owns the result location (new required `ATHENA_WORKGROUP` and `ATHENA_QUERY_RESULTS_PREFIX` env vars) ([#5136](https://github.com/quiltdata/quilt/pull/5136))
- [Added] Make `s3.copy()` chunk size and concurrency configurable via env vars ([#4746](https://github.com/quiltdata/quilt/pull/4746))
- [Added] Bundle `awscrt` via `boto3[crt]` for improved S3 transfer performance ([#4746](https://github.com/quiltdata/quilt/pull/4746))
- [Changed] Migrate to proper package structure ([#4618](https://github.com/quiltdata/quilt/pull/4618))
- [Changed] Switch to uv ([#4618](https://github.com/quiltdata/quilt/pull/4618))
- [Changed] Upgrade to Python 3.13 ([#4618](https://github.com/quiltdata/quilt/pull/4618))
- [Changed] Upgrade to Python 3.11 ([#4241](https://github.com/quiltdata/quilt/pull/4241))
- [Added] Bootstrap the change log ([#4241](https://github.com/quiltdata/quilt/pull/4241))
