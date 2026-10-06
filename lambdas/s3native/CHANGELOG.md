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

- [Added] Native S3 EventBridge events become the S3 notification records the indexer, package-events queue and stack bus already read, so a bucket can feed a stack without an SNS topic (draft, no PR yet)
