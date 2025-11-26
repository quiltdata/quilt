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

- [Added] Add CRC64NVME checksum support with algorithm-agnostic MPU computation ([#4624](https://github.com/quiltdata/quilt/pull/4624))
- [Changed] Use `make_scratch_key()` function from py-shared to avoid S3 Slow Down errors ([#4358](https://github.com/quiltdata/quilt/pull/4358))
- [Changed] Move some constants and `Checksum` methods to py-shared ([#4358](https://github.com/quiltdata/quilt/pull/4358))
- [Changed] Bump pydantic to v2 ([#4355](https://github.com/quiltdata/quilt/pull/4355))
- [Fixed] Fix copy to unversioned buckets ([#4300](https://github.com/quiltdata/quilt/pull/4300))
- [Changed] Upgrade to Python 3.11 ([#4241](https://github.com/quiltdata/quilt/pull/4241))
- [Fixed] Fix invalid checksum for some non-canonical objects with existing checksum ([#4062](https://github.com/quiltdata/quilt/pull/4062))
- [Changed] Use per-region scratch buckets ([#3923](https://github.com/quiltdata/quilt/pull/3923))
- [Changed] Always stream bytes in legacy mode ([#3903](https://github.com/quiltdata/quilt/pull/3903))
- [Changed] Compute chunked checksums, adhere to the spec ([#3889](https://github.com/quiltdata/quilt/pull/3889))
- [Added] Lambda handler for file copy ([#3884](https://github.com/quiltdata/quilt/pull/3884))
- [Changed] Compute multipart checksums ([#3402](https://github.com/quiltdata/quilt/pull/3402))
- [Added] Bootstrap the change log ([#3402](https://github.com/quiltdata/quilt/pull/3402))
