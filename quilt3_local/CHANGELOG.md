# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2022-10-13

### Changed

- Enable rendering HTML files.

## [1.1.2] - 2022-10-13

### Fixed

- Fix thumbnail rendering issue introduced in `1.1.1`.

## [1.1.1] - 2022-10-12

### Fixed

- Fix tabular data previews via Perspective (add `tabular_preview` lambda).

## [1.1.0] - 2022-10-11

### Changed

- Update catalog (see [commit history](https://github.com/quiltdata/quilt/compare/4b09639ebd1c3135cd7a16f301ef4a8b6de18955...85b35361fde4edbbaf771b6b122aad46a0acaa0a) for details). Most notable changes:
  - Preview tabular data with Perspective.
  - Preview molecule models with NGL.
  - Preview CZI files.
  - Preview genomics data with IGV.
  - Create and edit files in S3 buckets via catalog UI.
- Update GraphQL schema, add dummy resolvers for some of the added types.
- Update `aicsimageio` to `3.1.4` so the package can be installed with `poetry`.

## [1.0.1] - 2022-01-31

Initial public release.

[Unreleased]: https://github.com/quiltdata/local/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/quiltdata/local/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/quiltdata/local/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/quiltdata/local/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/quiltdata/local/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/quiltdata/local/releases/tag/v1.0.1
