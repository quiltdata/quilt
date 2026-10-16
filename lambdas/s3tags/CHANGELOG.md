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

- [Changed] The lambda reads each bucket's tag mapping from the registry, where admins edit it, instead of `.quilt/s3_tags.yml` ([#5447](https://github.com/quiltdata/quilt/pull/5447))
- [Added] A lambda writes the package-metadata fields a bucket maps in `.quilt/s3_tags.yml` as S3 tags on the package's object versions, on every package revision ([#5441](https://github.com/quiltdata/quilt/pull/5441))
