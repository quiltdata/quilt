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

- [Changed] Compute the 16-bit rescale percentiles via a histogram instead of `np.percentile`, lowering peak memory on large images (output unchanged) ([#????](https://github.com/quiltdata/quilt/pull/????))
- [Fixed] Convert normalized greyscale thumbnails (montages, Z-projections) to 16-bit explicitly before PNG save, instead of relying on the implicit clip to 16-bit that Pillow 13 removes ([#4967](https://github.com/quiltdata/quilt/pull/4967))
- [Fixed] 500 on image formats readable by bioio-imageio but missing from its declared extensions, e.g. `.jpeg` and `.webp` ([#4963](https://github.com/quiltdata/quilt/pull/4963))
- [Fixed] Support float and 16-bit color images instead of failing with HTTP 500 ([#4961](https://github.com/quiltdata/quilt/pull/4961))
- [Fixed] Rescale 16-bit greyscale images by their actual value range to avoid nearly black thumbnails for low-range (e.g. 12-bit) data ([#4960](https://github.com/quiltdata/quilt/pull/4960))
- [Fixed] Clean up tmp directory to deal with tmp files persisted between invocations when lambda is killed because of OOM ([#4627](https://github.com/quiltdata/quilt/pull/4627))
- [Fixed] Fix handling of some .tiff files ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Fixed] Fix handling of .czi files ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Changed] Switch from aicsimageio to bioio ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Changed] Switch to uv ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Changed] Update to Python 3.13 ([#4609](https://github.com/quiltdata/quilt/pull/4609))
- [Added] More test images through Quilt packages ([#4612](https://github.com/quiltdata/quilt/pull/4612))
- [Changed] Regenerate requirements.txt ([#4241](https://github.com/quiltdata/quilt/pull/4241))
- [Added] Allow overriding PIL.Image.MAX_IMAGE_PIXELS using env var ([#4100](https://github.com/quiltdata/quilt/pull/4100))
