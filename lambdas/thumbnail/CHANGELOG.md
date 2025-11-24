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

- [Fixed] Clean up tmp directory to deal with tmp files persisted between invocations when lambda is killed because of OOM ([#4627](https://github.com/quiltdata/quilt/pull/4627))
- [Fixed] Fix handling of some .tiff files ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Fixed] Fix handling of .czi files ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Changed] Switch from aicsimageio to bioio ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Changed] Switch to uv ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Changed] Update to Python 3.13 ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Added] More test images through Quilt packages ([#4612](https://github.com/quiltdata/quilt/pull/4612))
- [Changed] Regenerate requirements.txt ([#4241](https://github.com/quiltdata/quilt/pull/4241))
- [Added] Allow overriding PIL.Image.MAX_IMAGE_PIXELS using env var ([#4100](https://github.com/quiltdata/quilt/pull/4100))
