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

- [Added] Add `set_handler`, an entry point that writes SQS batches of package events to the stack-wide Iceberg package tables in `QUILT_STACK_DATABASE`, returning the events to retry as batch item failures and sending those no retry can write to `QUILT_STACK_DEAD_LETTER_QUEUE_URL` ([#5407](https://github.com/quiltdata/quilt/pull/5407))
- [Fixed] Update `quilt-shared` to escape package names, tag names and top hashes in the lambda's Athena statements ([#5424](https://github.com/quiltdata/quilt/pull/5424))
- [Changed] Update `quilt-shared` to retry index writes that fail with `ICEBERG_COMMIT_ERROR` and report Athena's failure reason ([#5423](https://github.com/quiltdata/quilt/pull/5423))
- [Changed] Update `quilt-shared` to pick up the per-bucket `QueryMaker`, so the lambda writes package-index rows to per-bucket `{bucket}_{table}` Iceberg tables. ([#4931](https://github.com/quiltdata/quilt/pull/4931))
- [Changed] Upgrade to Python 3.13 ([#4656](https://github.com/quiltdata/quilt/pull/4656))
- [Added] Bootstrap the change log ([#4570](https://github.com/quiltdata/quilt/pull/4570))
