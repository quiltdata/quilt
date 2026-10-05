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

- [Added] Add `set_handler`, an entry point that writes SQS batches of package events to the stack-wide Iceberg package tables in `QUILT_STACK_DATABASE`, returning the events to retry as batch item failures ([#PR](https://github.com/quiltdata/quilt/pull/PR))
- [Changed] Update `quilt-shared`, so the per-event handler retries a statement whose Iceberg commit lost to a concurrent one ([#PR](https://github.com/quiltdata/quilt/pull/PR))
- [Changed] Update `quilt-shared` to pick up the per-bucket `QueryMaker`, so the lambda writes package-index rows to per-bucket `{bucket}_{table}` Iceberg tables. ([#4931](https://github.com/quiltdata/quilt/pull/4931))
- [Changed] Upgrade to Python 3.13 ([#4656](https://github.com/quiltdata/quilt/pull/4656))
- [Added] Bootstrap the change log ([#4570](https://github.com/quiltdata/quilt/pull/4570))
