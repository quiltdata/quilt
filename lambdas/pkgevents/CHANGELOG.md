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

- [Fixed] Drop `s3:TestEvent` messages and report other failures per message via `ReportBatchItemFailures`, instead of failing the whole SQS batch and dead-lettering the real package events in it ([#5162](https://github.com/quiltdata/quilt/pull/5162))
- [Fixed] Process package pointers from year 2026+ ([#4683](https://github.com/quiltdata/quilt/pull/4683))
- [Changed] Migrate to proper package structure ([#4647](https://github.com/quiltdata/quilt/pull/4647))
- [Changed] Switch to uv ([#4647](https://github.com/quiltdata/quilt/pull/4647))
- [Changed] Upgrade to Python 3.13 ([#4647](https://github.com/quiltdata/quilt/pull/4647))
- [Changed] Upgrade to Python 3.11 ([#4241](https://github.com/quiltdata/quilt/pull/4241))
- [Added] Bootstrap the change log ([#4241](https://github.com/quiltdata/quilt/pull/4241))
