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

- [Changed] Switch to uv ([#4649](https://github.com/quiltdata/quilt/pull/4649))
- [Changed] Upgrade to Python 3.13 ([#4649](https://github.com/quiltdata/quilt/pull/4649))
- [Added] CRC64NVME checksum support with priority-based multi-algorithm selection and optimized precomputed checksum retrieval ([#4625](https://github.com/quiltdata/quilt/pull/4625))
- [Added] Respect new `dest_prefix` parameter for setting prefix to copy data to when promoting packages with `copy_data: true` ([#4383](https://github.com/quiltdata/quilt/pull/4383))
- [Changed] Remove limits on number of files and bytes to be hashed from QPE lambda ([#4355](https://github.com/quiltdata/quilt/pull/4355))
- [Changed] Improve packaging performance when many small (< 8 MiB) objects have to be hashed ([#4355](https://github.com/quiltdata/quilt/pull/4355))
- [Changed] Bump pydantic to v2 ([#4355](https://github.com/quiltdata/quilt/pull/4355))
- [Added] Entrypoint for Quilt Packaging Engine ([#4304](https://github.com/quiltdata/quilt/pull/4304))
- [Fixed] Fix promotion with data copy to unversioned buckets ([#4300](https://github.com/quiltdata/quilt/pull/4300))
- [Changed] Upgrade to Python 3.11 ([#4241](https://github.com/quiltdata/quilt/pull/4241))
- [Changed] Use per-region scratch buckets ([#3923](https://github.com/quiltdata/quilt/pull/3923))
- [Changed] Speed-up copying of large files during promotion ([#3884](https://github.com/quiltdata/quilt/pull/3884))
- [Changed] Bump quilt3 to set max_pool_connections, this improves performance ([#3870](https://github.com/quiltdata/quilt/pull/3870))
- [Changed] Compute multipart checksums ([#3402](https://github.com/quiltdata/quilt/pull/3402))
- [Added] Bootstrap the change log ([#3402](https://github.com/quiltdata/quilt/pull/3402))
