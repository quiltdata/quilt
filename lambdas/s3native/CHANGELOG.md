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

- [Added] Forward native S3 EventBridge events to the indexer, package-events queue and stack bus as S3 notification records, so a bucket can feed a stack without an SNS topic ([#5450](https://github.com/quiltdata/quilt/pull/5450))
