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

- [Added] Add CRC64NVME checksum type support ([#4623](https://github.com/quiltdata/quilt/pull/4623))
- [Added] Add utilities for Athena/Iceberg ([#4570](https://github.com/quiltdata/quilt/pull/4570))
- [Added] Add various utilities for ES ingest ([#4433](https://github.com/quiltdata/quilt/pull/4433))
- [Added] Add optional `dest_prefix` to `PackagePromoteParams` for setting prefix to copy data to ([#4382](https://github.com/quiltdata/quilt/pull/4382))
- [Added] Move some constants and Checksum methods from s3hash lambda ([#4368](https://github.com/quiltdata/quilt/pull/4368))
- [Added] Add `make_scratch_key()` function ([#4368](https://github.com/quiltdata/quilt/pull/4368))
- [Changed] Bump pydantic to v2 ([#4354](https://github.com/quiltdata/quilt/pull/4354))
- [Changed] Make version optional in `CopyResult` for unversioned dst buckets ([#4299](https://github.com/quiltdata/quilt/pull/4299))
- [Changed] **BREAKING**: Make `AWSCredentials` frozen ([#4197](https://github.com/quiltdata/quilt/pull/4197))
- [Changed] **BREAKING**: Add `scratch_buckets` required field to `S3HashLambdaParams` ([#3922](https://github.com/quiltdata/quilt/pull/3922))
- [Added] Introduce `PackageConstructParams` ([#3922](https://github.com/quiltdata/quilt/pull/3922))
- [Changed] Tweak checksum types ([#3888](https://github.com/quiltdata/quilt/pull/3888))
- [Added] Bootstrap `quilt_shared` package ([#3849](https://github.com/quiltdata/quilt/pull/3849))
