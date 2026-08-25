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

- [Fixed] A preview with no rows is now a loadable Arrow file: a 0-row table yields no record batches, and a batch-less IPC file cannot be loaded, so a header-only file or one whose every data row was skipped as invalid failed to render instead of showing an empty table ([#5214](https://github.com/quiltdata/quilt/pull/5214))
- [Added] Preview h5ad (anndata) files ([#4636](https://github.com/quiltdata/quilt/pull/4636))
- [Changed] Switch to uv ([#4654](https://github.com/quiltdata/quilt/pull/4654))
- [Changed] Upgrade to Python 3.13 ([#4654](https://github.com/quiltdata/quilt/pull/4654))
- [Changed] Upgrade to Python 3.11 ([#4241](https://github.com/quiltdata/quilt/pull/4241))
- [Added] Bootstrap the change log ([#4241](https://github.com/quiltdata/quilt/pull/4241))
