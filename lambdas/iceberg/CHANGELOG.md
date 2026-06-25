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

- [Changed] Update `quilt-shared` to pick up the per-bucket `QueryMaker`, so the lambda writes package-index rows to per-bucket `{bucket}_{table}` Iceberg tables. ([#4931](https://github.com/quiltdata/quilt/pull/4931))
- [Changed] Upgrade to Python 3.13 ([#4656](https://github.com/quiltdata/quilt/pull/4656))
- [Added] Bootstrap the change log ([#4570](https://github.com/quiltdata/quilt/pull/4570))
