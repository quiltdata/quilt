<!-- markdownlint-disable line-length -->
<!--
Entries inside each section should be ordered by type:
1. Removed
2. Added
3. Fixed
4. Changed
!-->
<!--template:
## unreleased - YYYY-MM-DD

### Python API

### CLI
!-->

# Changelog

## 6.3.1 - 2025-03-10

### Python API

* [Changed] **BREAKING:** Forbid using non-finite `float`s in package metadata. Previously that was allowed and resulted in package manifests that are not compliant to RFC 8259 ([#4340](https://github.com/quiltdata/quilt/pull/4340))

## 6.3.0 - 2025-01-24

### Python API

* [Added] `quilt3.hooks`: `set_build_s3_client_hook()` function for customizing S3 client ([#4289](https://github.com/quiltdata/quilt/pull/4289))

## 6.2.0 - 2025-01-14

### CLI

* [Fixed] Fix installation of `quilt3[catalog]` ([#4287](https://github.com/quiltdata/quilt/pull/4287))

### Python API

* [Added] `quilt3.admin.tabulator`: `get_open_query()` and `set_open_query()` functions for managing Tabulator open query mode ([#4260](https://github.com/quiltdata/quilt/pull/4260))

## 6.1.1 - 2024-11-21

### Python API

* [Changed] More informative error messages when package construction fails ([#4216](https://github.com/quiltdata/quilt/pull/4216))
* [Fixed] Allow S3 paths starting with `/` in `Package.set_dir()` and `Package.set()` ([#4207](https://github.com/quiltdata/quilt/pull/4207))

## 6.1.0 - 2024-10-14

### Python API

* [Added] `quilt3.admin.tabulator` sub-module for managing Tabulator configuration ([#4136](https://github.com/quiltdata/quilt/pull/4136))
* [Added] `quilt3.get_boto3_session()` function for creation of Boto3 sessions with Quilt credentials ([#4169](https://github.com/quiltdata/quilt/pull/4169))

## 6.0.0 - 2024-08-19

### Python API

* [Added] New `quilt3.admin.sso_config` sub-module for management of SSO configuration ([#4065](https://github.com/quiltdata/quilt/pull/4065), [#4098](https://github.com/quiltdata/quilt/pull/4098))

### Catalog, Lambdas

* [Fixed] **SECURITY**: Remove `polyfill.io` references ([#4038](https://github.com/quiltdata/quilt/pull/4038))
* [Fixed] Don't show negative number as search result count, in particular don't show `-1` when `secure_search: True` ([#4101](https://github.com/quiltdata/quilt/pull/4101))
* [Changed] Renamed "Admin settings" to "Admin" ([#4045](https://github.com/quiltdata/quilt/pull/4045))
* [Changed] Hide "Add bucket" button for non-admin users from main landing page ([#4106](https://github.com/quiltdata/quilt/pull/4106))
* [Added] Admin: Support SSO permissions mapping (SSO config editor, disable role assignment for SSO-mapped users) ([#4070](https://github.com/quiltdata/quilt/pull/4070), [#4097](https://github.com/quiltdata/quilt/pull/4097), [#4099](https://github.com/quiltdata/quilt/pull/4099))

## 6.0.0a5 - 2024-06-25

### Python API

* [Fixed] Fix PhysicalKey to URI conversion in Python 3.12 on Windows ([#4027](https://github.com/quiltdata/quilt/pull/4027))

### Catalog, Lambdas

* [Removed] Drop MARKETING mode support, delete associated dead code ([#4009](https://github.com/quiltdata/quilt/pull/4009))
* [Removed] Delete Google Tag Manager script integration ([#4039](https://github.com/quiltdata/quilt/pull/4039))
* [Added] Support multiple roles per user ([#3982](https://github.com/quiltdata/quilt/pull/3982))
* [Added] Add `ui.actions = False` and `ui.actions.writeFile` for configuring visibility of buttons ([#4001](https://github.com/quiltdata/quilt/pull/4001))
* [Added] Support creating folders and rearranging entries with drag and drop in package creation dialog ([#3999](https://github.com/quiltdata/quilt/pull/3999))
* [Added] Qurator AI Assistant for summarizing file contents using Bedrock API ([#3989](https://github.com/quiltdata/quilt/pull/3989))

## 6.0.0a4 - 2024-06-18

### Python API

* [Added] New `quilt3.admin` API with more features (requires 1.53+ stack) ([#3990](https://github.com/quiltdata/quilt/pull/3990))
* [Removed] `quilt3.admin` API ([#3990](https://github.com/quiltdata/quilt/pull/3990))
* [Removed] Drop Python 3.8 support ([#3993](https://github.com/quiltdata/quilt/pull/3993))
* [Fixed] If upload optimization during `push()` succeeds the checksum is calculated from local file instead of remote file ([#3968](https://github.com/quiltdata/quilt/pull/3968))
* [Changed] Upload optimization check now tries to use S3 SHA-256 checksum and falls back to ETag ([#3968](https://github.com/quiltdata/quilt/pull/3968))

### Catalog, Lambdas

* [Changed] Use promises for URLs in IGV to have fresh signing each time they used ([#3979](https://github.com/quiltdata/quilt/pull/3979))

## 6.0.0a3 - 2024-04-25

### Python API

* [Added] `quilt3.search()` and `quilt3.Bucket.search()` now accepts custom Elasticsearch queries ([#3448](https://github.com/quiltdata/quilt/pull/3448))
* [Fixed] `quilt3.search()` and `quilt3.Bucket.search()` now work with 2022+ Quilt stacks ([#3448](https://github.com/quiltdata/quilt/pull/3448))

### Catalog, Lambdas

* [Added] Added "text" as a file type for quilt_summarize.json ([#3946](https://github.com/quiltdata/quilt/pull/3946))
* [Added] Sign URL in undocumented `compressedIndexURL` IGV property ([#3947](https://github.com/quiltdata/quilt/pull/3947))
* [Fixed] Robust handling of PFS cookies ([#3962](https://github.com/quiltdata/quilt/pull/3962))
* [Changed] Pre-select first catalog and database for Athena ([#3949](https://github.com/quiltdata/quilt/pull/3949))
* [Changed] Move pagination to the bottom ([#3950](https://github.com/quiltdata/quilt/pull/3950))
* [Changed] Search UI QoL improvements ([#3960](https://github.com/quiltdata/quilt/pull/3960), [#3967](https://github.com/quiltdata/quilt/pull/3967))

## 6.0.0a2 - 2024-04-15

### Python API

* [Added] New 'unversioned' parameter to `Package.set_dir()` and `Package.set()` for use with S3 URIs, such as HealthOmics, that do not support `ListBucketVersions` and/or `GetObjectVersion` ([#3927](https://github.com/quiltdata/quilt/pull/3927))

## 6.0.0a1 - 2024-02-26

### Python API

* [Removed] Drop Python 3.7 support ([#3841](https://github.com/quiltdata/quilt/pull/3841))
* [Changed] Set S3 client `max_pool_connections` to `QUILT_TRANSFER_MAX_CONCURRENCY` ([#3867](https://github.com/quiltdata/quilt/pull/3867))
* [Changed] **BREAKING:** Switch from a regular SHA256 checksum to a hash list (`sha2-256-chunked`) to match S3's built-in checksums ([#2782](https://github.com/quiltdata/quilt/pull/2782))
* [Changed] **BREAKING:** Delay object hashing until package push to take advantage of S3's hashing; as a result, `dest` functions no longer receive a `top_hash` ([#2782](https://github.com/quiltdata/quilt/pull/2782))

### Catalog, Lambdas

* [Added] Support chunked checksums ([#3403](https://github.com/quiltdata/quilt/pull/3403), [#3887](https://github.com/quiltdata/quilt/pull/3887))
* [Added] Search: Help link to ElasticSearch docs ([#3861](https://github.com/quiltdata/quilt/pull/3861))
* [Added] Support MP PAYGO: track subscription state, handle related errors ([#3906](https://github.com/quiltdata/quilt/pull/3906))
* [Fixed] Faceted Search: show helpful message in case of search query syntax errors ([#3821](https://github.com/quiltdata/quilt/pull/3821))
* [Fixed] JsonEditor: fix changing collections items, that have `.additionalProperties` or `.items` JSON Schema ([#3860](https://github.com/quiltdata/quilt/pull/3860))
* [Fixed] Restore Catalog name / Database for Athena query execution ([#3902](https://github.com/quiltdata/quilt/pull/3902))
* [Changed] Faceted Search: use non-linear scale for numeric range control ([#3805](https://github.com/quiltdata/quilt/pull/3805))
* [Changed] Faceted Search: reliably find metadata facets ([#3809](https://github.com/quiltdata/quilt/pull/3809))
* [Changed] Athena: add docs link for empty state, remove "Queries" tab for guests ([#3885](https://github.com/quiltdata/quilt/pull/3885))
* [Changed] Updated supported node/npm version to v20 and v10 ([#3873](https://github.com/quiltdata/quilt/pull/3873))

## 5.4.0 - 2023-11-29

### Python API

* [Added] `create_user()`, `delete_user()`, `set_role()` in `quilt3.admin` ([#3764](https://github.com/quiltdata/quilt/pull/3764))

### Catalog, Lambdas

* [Fixed] Fixed file preview header layout ([#3454](https://github.com/quiltdata/quilt/pull/3454))
* [Fixed] Fix getting custom styles and options for files listed in quilt_summarize.json ([#3485](https://github.com/quiltdata/quilt/pull/3485))
* [Fixed] Fix Header's orange flash on load ([#3487](https://github.com/quiltdata/quilt/pull/3487))
* [Fixed] Fix code sample for package push ([#3499](https://github.com/quiltdata/quilt/pull/3499))
* [Fixed] Make bookmarks optional (and fix Embed listings broken in #3697) ([#3705](https://github.com/quiltdata/quilt/pull/3705))
* [Fixed] Disable opening file picker on metadata click, and fix dropping JSON as metadata ([#3707](https://github.com/quiltdata/quilt/pull/3707))
* [Fixed] Faceted Search: crash due to infinite recursion on duplicate facets ([#3799](https://github.com/quiltdata/quilt/pull/3799))
* [Fixed] Hide filters in a sidebar drawer on mobile ([#3801](https://github.com/quiltdata/quilt/pull/3801))
* [Fixed] Fix copying selected text in code samples ([#3803](https://github.com/quiltdata/quilt/pull/3803))
* [Fixed] Add current bucket as a succesor if it's missed from config ([#3811](https://github.com/quiltdata/quilt/pull/3811))
* [Added] Add filter for users and buckets tables in Admin dashboards ([#3480](https://github.com/quiltdata/quilt/pull/3480))
* [Added] Add links to documentation and re-use code samples ([#3496](https://github.com/quiltdata/quilt/pull/3496))
* [Added] Show S3 Object tags ([#3515](https://github.com/quiltdata/quilt/pull/3515))
* [Added] Indexer lambda now indexes S3 Object tags ([#3691](https://github.com/quiltdata/quilt/pull/3691))
* [Added] Add filters to Roles and Permissions in Admin dashboards ([#3690](https://github.com/quiltdata/quilt/pull/3690))
* [Added] Add download and bookmarks button to file listings ([#3697](https://github.com/quiltdata/quilt/pull/3697))
* [Changed] Enable user selection in perspective grids ([#3453](https://github.com/quiltdata/quilt/pull/3453))
* [Changed] Hide columns without values in files listings ([#3512](https://github.com/quiltdata/quilt/pull/3512))
* [Changed] Enable `allow-same-origin` for iframes in browsable buckets ([#3516](https://github.com/quiltdata/quilt/pull/3516))
* [Changed] Allow users select files and directories and keep selection whenever they navigate to multiple directories or use filter ([#3527](https://github.com/quiltdata/quilt/pull/3527))
* [Changed] Unify per-bucket and global search ([#3613](https://github.com/quiltdata/quilt/pull/3613))
* [Changed] Allow use of `<br />` in Markdown ([#3720](https://github.com/quiltdata/quilt/pull/3720))
* [Changed] Faceted search ([#3712](https://github.com/quiltdata/quilt/pull/3712))
* [Changed] Specify condition for rendering Quilt manifests, allowing to render other types of files in `.quilt/packages/` ([#3816](https://github.com/quiltdata/quilt/pull/3816))

## 5.3.1 - 2023-05-02

### Python API

* [Fixed] `Package.verify()` now raises exception if unsupported hash type is encountered ([#3401](https://github.com/quiltdata/quilt/pull/3401))

### Catalog, Lambdas

* [Fixed] Fix file URLs in embed ([#3419](https://github.com/quiltdata/quilt/pull/3419))
* [Changed] Increased available file size to render Markdown preview to 3MiB ([#3427](https://github.com/quiltdata/quilt/pull/3427))

## 5.3.0 - 2023-04-11

### Python API

* [Added] Support [AnnData](https://anndata.readthedocs.io/en/latest/) format ([#2974](https://github.com/quiltdata/quilt/pull/2974))
* [Added] `--no-copy` parameter to `Package.push()` ([#3398](https://github.com/quiltdata/quilt/pull/3398))

### Catalog, Lambdas

* [Fixed] Fix package push failing for unrelated reason ([#3390](https://github.com/quiltdata/quilt/pull/3390))
* [Fixed] Fix package page flash when there is Jupyter Notebook ([#3408](https://github.com/quiltdata/quilt/pull/3408))
* [Added] Add `gallery` field for configuring galleries visibility ([#3421](https://github.com/quiltdata/quilt/pull/3421))

## 5.2.1 - 2023-04-05

### Python API

* [Fixed] Fixed CSV serialization with pandas 2 ([#3395](https://github.com/quiltdata/quilt/pull/3395))

## 5.2.0 - 2023-03-27

### Python API

* [Added] Validation of package entries metadata ([#3286](https://github.com/quiltdata/quilt/pull/3286))

### Catalog, Lambdas

* [Added] Add basic support for tasklist in Markdown ([#3339](https://github.com/quiltdata/quilt/pull/3339))
* [Added] Object-level validation, frontend ([#3336](https://github.com/quiltdata/quilt/pull/3336))
* [Added] Frontend for permissive HTML rendering ([#3198](https://github.com/quiltdata/quilt/pull/3198))
* [Added] Confirmation to enable Package Files Server ([#3388](https://github.com/quiltdata/quilt/pull/3388))
* [Fixed] Fixed mobile layout for collaborators badges ([#3307](https://github.com/quiltdata/quilt/pull/3307))
* [Fixed] Fixed metadata handling for entries without hash or size in pkgpush lambda ([#3314](https://github.com/quiltdata/quilt/pull/3314))
* [Fixed] Fixed adding metadata for S3 entries ([#3367](https://github.com/quiltdata/quilt/pull/3367))
* [Fixed] Fixed crash of the iframe in Bucket tab ([3387](https://github.com/quiltdata/quilt/pull/3387))
* [Changed] Edit .quilt/config files with text editor ([#3306](https://github.com/quiltdata/quilt/pull/3306))
* [Changed] Refactoring of buttons adapted to page width ([#3300](https://github.com/quiltdata/quilt/pull/3300))
* [Changed] Restrict editing `user_meta` field only for object-level metadata ([#3337](https://github.com/quiltdata/quilt/pull/3337))
* [Changed] Tabular format defaults to .csv ([#3382](https://github.com/quiltdata/quilt/pull/3382))

## 5.1.1 - 2023-01-25

### Python API

* [Fixed] Reduce backtracking during `pip install quilt3[catalog]` ([#3292](https://github.com/quiltdata/quilt/pull/3292))

### Catalog, Lambdas

* [Added] Add 'ECharts' and 'Text' file type switcher, significantly refactor this switcher ([#3240](https://github.com/quiltdata/quilt/pull/3240))
* [Added] Add link to file from Athena results ([#3242](https://github.com/quiltdata/quilt/pull/3242))
* [Added] Add link to package revisions from package list ([#3256](https://github.com/quiltdata/quilt/pull/3256))
* [Added] WebP support in thumbnail lambda ([#3275](https://github.com/quiltdata/quilt/pull/3275))
* [Added] Set default search mode in Admin Settings ([#3270](https://github.com/quiltdata/quilt/pull/3270))
* [Added] Toggle buttons for file previews ([#3290](https://github.com/quiltdata/quilt/pull/3290))
* [Fixed] Fix performance issue (missing memoization) in search results ([#3257](https://github.com/quiltdata/quilt/pull/3257))
* [Fixed] Fix fetching and writing settings in Admin/Settings section ([#3276](https://github.com/quiltdata/quilt/pull/3276))
* [Fixed] Fix iframe preview width ([#3279](https://github.com/quiltdata/quilt/pull/3279))
* [Changed] Make file preview wrapper consistently 100% width ([#3245](https://github.com/quiltdata/quilt/pull/3245))
* [Changed] Show collapsed values in JSON viewer ([#3249](https://github.com/quiltdata/quilt/pull/3249))
* [Changed] Rename "Metadata" to "User metadata" ([#3255](https://github.com/quiltdata/quilt/pull/3255))
* [Changed] Show selective metadata for packages as JSON ([#3259](https://github.com/quiltdata/quilt/pull/3259))
* [Changed] Show selective metadata on one line and optionally on multiple lines ([#3284](https://github.com/quiltdata/quilt/pull/3284))

## 5.1.0 - 2022-12-09

### Python API

* [Added] `dedupe` parameter for `Package.push()` ([#3181](https://github.com/quiltdata/quilt/pull/3181))
* [Fixed] Fix check to determine if a file is a tempfile in Windows with Python 3.8+ ([#2900](https://github.com/quiltdata/quilt/pull/2900))
* [Fixed] Speed up import and get rid of undeclared runtime dependency on `setuptools` ([#2994](https://github.com/quiltdata/quilt/pull/2994))
* [Changed] Disable upload optimization for objects with SSE-KMS ([#2790](https://github.com/quiltdata/quilt/pull/2790))
* [Changed] Use `platformdirs` instead of unmaintained `appdirs` ([#3140](https://github.com/quiltdata/quilt/pull/3140))

### CLI

* [Added] `--dedupe` flag for `quilt3 push` ([#3181](https://github.com/quiltdata/quilt/pull/3181))

### Catalog, Lambdas

* [Added] Add IGV renderer ([#2965](https://github.com/quiltdata/quilt/pull/2965))
* [Added] Use `quilt_summarize.json` to control Perspective menu ([#2744](https://github.com/quiltdata/quilt/pull/2744))
* [Added] Show bucket collaborators ([#2756](https://github.com/quiltdata/quilt/pull/2756))
* [Added] Add `config` field to Perspective scope of `quilt_summarize.json` ([#2781](https://github.com/quiltdata/quilt/pull/2781))
* [Added] Add `blocks` field to `.quilt/catalog/config.yaml` to control blocks visibility ([#2791](https://github.com/quiltdata/quilt/pull/2791))
* [Added] Add theming with custom square logo and background color ([#2793](https://github.com/quiltdata/quilt/pull/2793))
* [Added] Admin: new roles and policies UI ([#2819](https://github.com/quiltdata/quilt/pull/2819))
* [Added] Deep search indexing for .pptx ([#2881](https://github.com/quiltdata/quilt/pull/2881))
* [Added] Stack Status Admin UI ([#2935](https://github.com/quiltdata/quilt/pull/2935))
* [Added] Render package manifests using Perspective ([#2971](https://github.com/quiltdata/quilt/pull/2971))
* [Added] Athena default workflow config setting ([#2985](https://github.com/quiltdata/quilt/pull/2985))
* [Added] Add missing README to package ([#2960](https://github.com/quiltdata/quilt/pull/2960), [#2979](https://github.com/quiltdata/quilt/pull/2979))
* [Added] View and copy full Athena query by expanding table row ([2993](https://github.com/quiltdata/quilt/pull/2993))
* [Added] Create packages from Athena query results ([#3004](https://github.com/quiltdata/quilt/pull/3004))
* [Added] Add "Create text file" menu ([#3017](https://github.com/quiltdata/quilt/pull/3017))
* [Added] Redirect to last selected Athena workgroup ([#3067](https://github.com/quiltdata/quilt/pull/3067))
* [Added] `status_reports` lambda ([#2989](https://github.com/quiltdata/quilt/pull/2989), [#3088](https://github.com/quiltdata/quilt/pull/3088))
* [Added] Stack Status Admin UI: reports ([#3068](https://github.com/quiltdata/quilt/pull/3068))
* [Added] Edit button for text files in packages ([#3070](https://github.com/quiltdata/quilt/pull/3070))
* [Added] Add execution context for Athena query execution ([#3062](https://github.com/quiltdata/quilt/pull/3062))
* [Added] Add confirmation if now every row is valid for creating package from Athena results ([#3073](https://github.com/quiltdata/quilt/pull/3073))
* [Added] Create file menu item for package ([#3127](https://github.com/quiltdata/quilt/pull/3127))
* [Added] Expose Quilt Catalog automation API as `window.QuiltCatalog` ([#3141](https://github.com/quiltdata/quilt/pull/3143))
* [Added] Add form to create workflow from quilt config editor ([#3158](https://github.com/quiltdata/quilt/pull/3158))
* [Added] Add extended value for `ui.blocks.meta` in `.quilt/catalog/config.yaml` ([#3175](https://github.com/quiltdata/quilt/pull/3175))
* [Fixed] Fix package creation in S3 buckets with SSE-KMS enabled ([#2754](https://github.com/quiltdata/quilt/pull/2754))
* [Fixed] Fix creation of packages with large (4+ GiB) files ([#2933](https://github.com/quiltdata/quilt/pull/2933))
* [Fixed] Fix pre-population of default dates when using "dateformat" + {"format": "date"} ([#3082](https://github.com/quiltdata/quilt/pull/3082))
* [Fixed] Fix editing nested files in packages, fix editing files added from the different location to package ([#3117](https://github.com/quiltdata/quilt/pull/3117))
* [Fixed] Fix enum detection in `anyOf`, `allOf`, `oneOf`, `not` fields and in arrays in JsonEditor ([#3169](https://github.com/quiltdata/quilt/pull/3169))
* [Fixed] Fix adding new elements in JsonEditor ([#3169](https://github.com/quiltdata/quilt/pull/3169))
* [Fixed] Fix enum free form fields ([#3185](https://github.com/quiltdata/quilt/pull/3185))
* [Fixed] User role and admin status caching ([#3200](https://github.com/quiltdata/quilt/pull/3200))
* [Changed] Clean up home page ([#2780](https://github.com/quiltdata/quilt/pull/2780)).
* [Changed] Make `pkgpush` lambda directly invocable, adjust handling of parameters and errors ([#2776](https://github.com/quiltdata/quilt/pull/2776))
* [Changed] Push packages via GraphQL ([#2768](https://github.com/quiltdata/quilt/pull/2768))
* [Changed] Improve rendering performance for multi-slide .pptx ([#2878](https://github.com/quiltdata/quilt/pull/2878))
* [Changed] Rework package indexing: now package indexes have documents only for current versions of package pointer objects, documents for 'latest' pointers have `package_hash`, `package_stats`, `comment`, `metadata` fields properly populated ([#2897](https://github.com/quiltdata/quilt/pull/2897))
* [Changed] Remove ClientRequestToken (idempotency token) for making Athena queries ([#2992](https://github.com/quiltdata/quilt/pull/2992))
* [Changed] Fixed config and docs mistyping: `ui.athena.defaultWorkflow` should be `ui.athena.defaultWorkgroup` ([#3067](https://github.com/quiltdata/quilt/pull/3067))
* [Changed] Use dedicated columns field instead of first row, fix duplicated first row in table results ([#3101](https://github.com/quiltdata/quilt/pull/3101))
* [Changed] Allow pushing empty packages, suggest creating a stub `README.md` file when trying to push an empty package ([#3114](https://github.com/quiltdata/quilt/pull/3114))
* [Changed] Allow to save only latest revisions of files ([#3124](https://github.com/quiltdata/quilt/pull/3124))
* [Changed] Render HTML files in LOCAL mode ([#3139](https://github.com/quiltdata/quilt/pull/3139))
* [Changed] Support dots in bucket names while using S3 proxy ([#3147](https://github.com/quiltdata/quilt/pull/3147))
* [Changed] Support `additionalProperties` and `items` in JsonEditor ([#3144](https://github.com/quiltdata/quilt/pull/3144))
* [Changed] Initialize Catalog configuration synchronously from `QUILT_CATALOG_CONFIG` global var ([#3166](https://github.com/quiltdata/quilt/pull/3166))
* [Changed] Handle rendering multiple molecules in one .sdf file ([#3179](https://github.com/quiltdata/quilt/pull/3179))
* [Changed] Refactor Sentry set-up, add more integrations / instrumentation ([#3164](https://github.com/quiltdata/quilt/pull/3164))

## 5.0.0 - 2022-03-14

### CLI

* [Added] `--force` flag for `quilt3 push` ([#2722](https://github.com/quiltdata/quilt/pull/2722))

### Catalog, Lambdas

* [Fixed] Respect prefix filtering when packaging a folder ([#2706](https://github.com/quiltdata/quilt/pull/2706))
* [Fixed] Fix package creation failing for some regions ([#2718](https://github.com/quiltdata/quilt/pull/2718))
* [Added] NGL renderer for .pdb files ([#2711](https://github.com/quiltdata/quilt/pull/2711))
* [Added] Admin: default role management ([#2721](https://github.com/quiltdata/quilt/pull/2721))
* [Added] Preview CZI images ([#2727](https://github.com/quiltdata/quilt/pull/2727))

## 4.1.0 - 2022-02-22

### Python API

* [Added] Automatically decompress gzip'ed package entries when deserializing ([#2677](https://github.com/quiltdata/quilt/pull/2677))
* [Added] Semi-atomic push ([#2689](https://github.com/quiltdata/quilt/pull/2689))

## 4.0.0 - 2022-01-31

### Python API

* [Added] Declared compatibility with `jsonschema==4.*`.
* [Added] `--host` and `--port` parameters for `quilt3 catalog`.
* [Added] `--no-browser` parameter for `quilt3 catalog`.
* [Changed] `quilt3 catalog` now requires `quilt3` to be installed with `catalog` extra dependency (`pip install 'quilt3[catalog]'`).
* [Changed] Dependencies on `flask` and `dnspython` are dropped.
* [Removed] Deprecated passing subpackage as part of package name for `Package.install()`, use `path` parameter instead.
* [Removed] Deprecated calling of `Package.resolve_hash()` without specifying `name` parameter.
* [Removed] Deprecated `PackageEntry.physical_keys`, use `PackageEntry.physical_key` instead.

### CLI

* [Removed] Deprecated passing subpackage as part of package name for `quilt3 install`, use `--path` parameter instead.

### Catalog, Lambdas

* [Changed] pkgselect: make directly invocable, always use execution role ([#2560](https://github.com/quiltdata/quilt/pull/2560))
* [Changed] Move package listing / querying to GraphQL ([#2552](https://github.com/quiltdata/quilt/pull/2552))
* [Changed] Fix performance of `countPages` in thumbnail lambda ([#2616](https://github.com/quiltdata/quilt/pull/2616)).
* [Changed] `pkgpush` lambda now uses dedicated lambda for hashing files to push larger packages faster from catalog.
* [Changed] Local-mode-specific adjustments to landing page and catalog UI ([#2611](https://github.com/quiltdata/quilt/pull/2611))
* [Changed] PDF preview: count pages again ([#2621](https://github.com/quiltdata/quilt/pull/2621))
* [Changed] Make Vega download data files from S3 via proxy to avoid CORS issues ([#2631](https://github.com/quiltdata/quilt/pull/2631))
* [Changed] Don't support packages in out-of-stack-buckets ([#2641](https://github.com/quiltdata/quilt/pull/2641))
* [Changed] Use Perspective library for tabular data files (.csv, .tsv, .xls, .xlsx, .parquet, .jsonl) ([#2576](https://github.com/quiltdata/quilt/pull/2576), [#2691](https://github.com/quiltdata/quilt/pull/2691))
* [Fixed] Improve upload performance and stability, fix some hashing-related errors ([#2532](https://github.com/quiltdata/quilt/pull/2532))
* [Added] Echarts renderer ([#2382](https://github.com/quiltdata/quilt/pull/2382))
* [Added] Set height for `quilt_summarize.json` files ([#2474](https://github.com/quiltdata/quilt/pull/2474))
* [Added] Add a "transcode" lambda for previewing video files ([#2366](https://github.com/quiltdata/quilt/pull/2366/))
* [Added] Add object-level metadata editor and move package metadata editor to popup ([#2510](https://github.com/quiltdata/quilt/pull/2510/))
* [Added] Video previews ([#2540](https://github.com/quiltdata/quilt/pull/2540))
* [Added] Audio previews ([#2547](https://github.com/quiltdata/quilt/pull/2547))
* [Added] Powerpoint (`.pptx`) preview ([#2598](https://github.com/quiltdata/quilt/pull/2598), [#2626](https://github.com/quiltdata/quilt/pull/2626))

## 3.6.0 - 2021-10-15

### Python API

* [Added] Validation of package names with `handle_pattern` in [workflows](advanced-features/workflows.md) config.
* [Added] Validation of package entries with `entries_schema` in [workflows](advanced-features/workflows.md) config.

## 3.5.0 - 2021-09-07

### Python API

* [Added] Size of each manifest record is now limited by 1 MB. This constraint is added to ensure that S3 select, Athena and downstream services work correctly. This limit can be overridden with `QUILT_MANIFEST_MAX_RECORD_SIZE` environment variable. ([#2114](https://github.com/quiltdata/quilt/pull/2114))
* [Changed] Decrease size of `Package` in-memory representation ([#1943](https://github.com/quiltdata/quilt/pull/1943))

### CLI

* [Added] `--workflow` argument to `push` command ([#2279](https://github.com/quiltdata/quilt/pull/2279))

### Catalog, Lambdas

* [Added] Pre-populate today date for metadata ([#2121](https://github.com/quiltdata/quilt/pull/2121))
* [Added] Limit and offset parameters in pkgselect lambda ([#2124](https://github.com/quiltdata/quilt/pull/2124))
* [Added] File listing: "load more" button to fetch more entries from S3 ([#2150](https://github.com/quiltdata/quilt/pull/2150))
* [Added] Voila Notebooks format support ([#2163](https://github.com/quiltdata/quilt/pull/2163))
* [Added] Ability to add files from S3 while revising a package ([#2171](https://github.com/quiltdata/quilt/pull/2171))
* [Added] Lambdas for pushing an existing package/creation of package ([#2147](https://github.com/quiltdata/quilt/pull/2147), [#2180](https://github.com/quiltdata/quilt/pull/2180))
* [Added] Custom navbar link configurable via admin UI ([#2192](https://github.com/quiltdata/quilt/pull/2192))
* [Added] Adding S3 objects to packages from configurable source buckets while revising ([#2193](https://github.com/quiltdata/quilt/pull/2193))
* [Added] Add Athena SQL queries initial viewer and runner ([#2197](https://github.com/quiltdata/quilt/pull/2197))
* [Added] Managing per-bucket permissions via admin UI ([#2228](https://github.com/quiltdata/quilt/pull/2228))
* [Added] Deep search indexing for Excel ([#2247](https://github.com/quiltdata/quilt/pull/2247))
* [Added] Deep search indexing for PDF ([#2256](https://github.com/quiltdata/quilt/pull/2256))
* [Added] Add Vega/JSON view switcher for Vega files ([#2236](https://github.com/quiltdata/quilt/pull/2236))
* [Added] Subpackage download ([#2258](https://github.com/quiltdata/quilt/pull/2258))
* [Added] Per-bucket deep indexing settings ([#2290](https://github.com/quiltdata/quilt/pull/2290))
* [Added] Embed: IPC, more debug features, docs ([#2314](https://github.com/quiltdata/quilt/pull/2314))
* [Added] Download button on Summary page ([#2367](https://github.com/quiltdata/quilt/pull/2367))
* [Added] Validation of package names and entries, pattern for default package name ([2364](https://github.com/quiltdata/quilt/pull/2364))
* [Changed] New DataGrid-based file listing UI with arbitrary sorting and filtering ([#2097](https://github.com/quiltdata/quilt/pull/2097))
* [Changed] Item selection in folder-to-package dialog ([#2122](https://github.com/quiltdata/quilt/pull/2122))
* [Changed] Don't preview .tif (but keep .tiff), preview .results as plain text ([#2128](https://github.com/quiltdata/quilt/pull/2128))
* [Changed] Sort packages by modification time by default ([#2126](https://github.com/quiltdata/quilt/pull/2126))
* [Changed] Resolve logical keys in summaries and vega inside packages ([#2140](https://github.com/quiltdata/quilt/pull/2140))
* [Changed] Embed: load polyfills, bring back prefix filtering, load more ([#2153](https://github.com/quiltdata/quilt/pull/2153))
* [Changed] Scan more bytes (first 128 KiB) when trying to detect if a JSON file is a Vega visualization ([#2229](https://github.com/quiltdata/quilt/pull/2229))
* [Changed] Use GraphQL for fetching and editing buckets ([#2240](https://github.com/quiltdata/quilt/pull/2240))
* [Changed] Use registry for search requests ([#2242](https://github.com/quiltdata/quilt/pull/2242))
* [Changed] Enhance `quilt_summarize.json` format, support title, description and multi-column layout ([#2245](https://github.com/quiltdata/quilt/pull/2245))
* [Changed] PDF preview: don't count pages ([#2276](https://github.com/quiltdata/quilt/pull/2276))
* [Changed] Default bucket icon changed from Quilt logo to more neutral ([#2287](https://github.com/quiltdata/quilt/pull/2287))
* [Changed] Cachebust revision list request ([#2298](https://github.com/quiltdata/quilt/pull/2298))
* [Changed] Wrap wide Vega charts with horizontal scroll ([#2304](https://github.com/quiltdata/quilt/pull/2304))
* [Changed] Unify package creation and update dialogs (support adding S3 files in both) ([#2302](https://github.com/quiltdata/quilt/pull/2302))
* [Changed] Warmer chart colors ([#2329](https://github.com/quiltdata/quilt/pull/2329), [#2338](https://github.com/quiltdata/quilt/pull/2338))
* [Changed] Remove custom button for adding Readme, and re-use dialog for creating files. Fix creating README in package ([#3173](https://github.com/quiltdata/quilt/pull/3173))
* [Fixed] `UnicodeDecodeError` in indexer and pkgselect lambdas ([#2123](https://github.com/quiltdata/quilt/pull/2123))
* [Fixed] Catch and display package-related errors properly ("no such package" and "bad revision") ([#2160](https://github.com/quiltdata/quilt/pull/2160))
* [Fixed] Crashing `pkgselect` lambda's folder view on an empty manifest ([#2147](https://github.com/quiltdata/quilt/pull/2147))
* [Fixed] Infinite spinner on logout ([#2232](https://github.com/quiltdata/quilt/pull/2232))
* [Fixed] Dismiss error page when navigating from it ([#2291](https://github.com/quiltdata/quilt/pull/2291))
* [Fixed] Avoid crash on non-existent logical keys in pkgselect detail view ([#2307](https://github.com/quiltdata/quilt/pull/2307)
* [Fixed] Error while rendering a preview inside a package ([#2328](https://github.com/quiltdata/quilt/pull/2328))
* [FIxed] Bring back missing username at Admin/Users table ([#2339](https://github.com/quiltdata/quilt/pull/2339))

## 3.4.0 - 2021-03-15

### Python API

* [Added] `QUILT_TRANSFER_MAX_CONCURRENCY` environment variable ([#2092](https://github.com/quiltdata/quilt/pull/2092))
* [Added] `QUILT_DISABLE_CACHE` environment variable ([#2091](https://github.com/quiltdata/quilt/pull/2091))
* [Added] Support for callable `dest` parameter in `Package.push()` ([#2095](https://github.com/quiltdata/quilt/pull/2095))
* [Changed] Removed unused dependency on `packaging` ([#2090](https://github.com/quiltdata/quilt/pull/2090))
* [Fixed] Possible downloading of truncated manifests ([#1977](https://github.com/quiltdata/quilt/pull/1977))
* [Fixed] `TypeError` on import when running with `PYTHONOPTIMIZE=2` ([#2102](https://github.com/quiltdata/quilt/pull/2102))

### Catalog, Lambdas

* [Added] Support for EventBridge S3 events to es/indexer ([#1987](https://github.com/quiltdata/quilt/pull/1987))
* [Added] Generate and resolve Quilt package URIs ([#1935](https://github.com/quiltdata/quilt/pull/1935))
* [Added] Buttons for copying canonical package URIs ([#1990](https://github.com/quiltdata/quilt/pull/1990))
* [Added] Additional validation for package name ([#1998](https://github.com/quiltdata/quilt/pull/1998))
* [Added] Populate package name with username prefix ([#2016](https://github.com/quiltdata/quilt/pull/2016))
* [Added] Link from bucket overview page to bucket settings ([#2022](https://github.com/quiltdata/quilt/pull/2022))
* [Added] Folder to package dialog ([#2040](https://github.com/quiltdata/quilt/pull/2040))
* [Added] Search lambda: `freeform` action API and UI ([#2087](https://github.com/quiltdata/quilt/pull/2087), [#2088](https://github.com/quiltdata/quilt/pull/2088))
* [Added] Spreadsheets Drag'n'Drop to Metadata ([#2094](https://github.com/quiltdata/quilt/pull/2094))
* [Changed] Tree view for files in package update dialog ([#1989](https://github.com/quiltdata/quilt/pull/1989))
* [Changed] Lambda indexing retry logic to not fail content extraction ([#2007](https://github.com/quiltdata/quilt/pull/2007))
* [Changed] Number of retries per ES and S3 failure in indexing Lambda ([#1987](https://github.com/quiltdata/quilt/pull/1987))
* [Changed] Handle delete markers in ES ([#1997](https://github.com/quiltdata/quilt/pull/1997), [#2000](https://github.com/quiltdata/quilt/pull/2000), [#2003](https://github.com/quiltdata/quilt/pull/2003), [#2017](https://github.com/quiltdata/quilt/pull/2017), [#2023](https://github.com/quiltdata/quilt/pull/2023))
* [Changed] Two-column layout for package dialogs ([#2001](https://github.com/quiltdata/quilt/pull/2001))
* [Changed] Show Schema validation errors in text mode ([#2010](https://github.com/quiltdata/quilt/pull/2010))
* [Changed] Toolchain: use webpack@5 ([#2036](https://github.com/quiltdata/quilt/pull/2036)) and TypeScript ([#2043](https://github.com/quiltdata/quilt/pull/2043)), ditch babel
* [Changed] Use polyfill.io instead of bundled polyfills ([#2043](https://github.com/quiltdata/quilt/pull/2043))
* [Changed] Render JSON with custom tree-like viewer ([#2037](https://github.com/quiltdata/quilt/pull/2037))
* [Changed] Set JSON Schema defaults ([#2053](https://github.com/quiltdata/quilt/pull/2053))
* [Changed] Don't upload unmodified files while revising a package ([#2080](https://github.com/quiltdata/quilt/pull/2080))
* [Fixed] Bug that caused search to miss delete object and delete package events ([#1987](https://github.com/quiltdata/quilt/pull/1987))
* [Fixed] lambda previews for time series `AICSImage` data (potential `IndexError` if odd number of time points) ([#1945](https://github.com/quiltdata/quilt/pull/1945))
* [Fixed] Handle folders in search results ([#1992](https://github.com/quiltdata/quilt/pull/1992), [#1994](https://github.com/quiltdata/quilt/pull/1994))
* [Fixed] Use EncodingType=url for S3 list requests to handle special chars in keys / prefixes ([#2026](https://github.com/quiltdata/quilt/pull/2026))
* [Fixed] Empty response from `pkgselect` folder view for packages with all non-string logical_keys or physical_keys ([#1947](https://github.com/quiltdata/quilt/pull/1947))
* [Fixed] "Download Directory" bug that caused 502 or failed downloads when any files contained the "+" character ([#2067](https://github.com/quiltdata/quilt/pull/2067/))
* [Added] Ability to log in with Microsoft Azure Active Directory
via OIDC ([#2089](https://github.com/quiltdata/quilt/pull/2089))

## 3.3.0 - 2020-12-08

### Python API

* [Added] Metadata quality API ([#1855](https://github.com/quiltdata/quilt/pull/1874)). For details see this [section](advanced-features/workflows.md).
* [Changed] Improved formatting of package load progress bar ([#1897](https://github.com/quiltdata/quilt/pull/1897))
* [Fixed] Crash during load of package manifest with unicode symbols with non-unicode locale set ([#1931](https://github.com/quiltdata/quilt/pull/1931))

### Catalog, Lambdas

* [Added] Ad hoc package updates ([#1856](https://github.com/quiltdata/quilt/pull/1856))
* [Added] Copy packages from one bucket to another ([#1932](https://github.com/quiltdata/quilt/pull/1932))
* [Added] Enhanced JSON editor and schema validation for package metadata ([#1867](https://github.com/quiltdata/quilt/pull/1867))
* [Added] Preview .pdbqt files as plain text ([#1855](https://github.com/quiltdata/quilt/pull/1855))
* [Added] Retry logic for failed queries, minimize load on ES for sample, images overviews ([#1864](https://github.com/quiltdata/quilt/pull/1864/))
* [Added] Buttons to download packages and directories as .zip archives ([#1868](https://github.com/quiltdata/quilt/pull/1868/))
* [Added] Search help dropdown for the index landing page ([#1838](https://github.com/quiltdata/quilt/pull/1838))
* [Changed] Get package revisions from ElasticSearch, not S3 ([#1851](https://github.com/quiltdata/quilt/pull/1851))
* [Changed] Render vega specs smaller than 20 MiB right away, render larger ones after pressing a button ([#1873](https://github.com/quiltdata/quilt/pull/1873))
* [Changed] Prefix filtering for directory view similar to AWS Console ([#1876](https://github.com/quiltdata/quilt/pull/1876), [#1880](https://github.com/quiltdata/quilt/pull/1880))
* [Changed] Preview `*notes` files as plain text ([#1896](https://github.com/quiltdata/quilt/pull/1896))
* [Changed] Default search operator to "AND" (was "OR") for more precise searches ([#1924](https://github.com/quiltdata/quilt/pull/1924))
* [Changed] `top_hash`-based package routes (timestamp routes are still supported in the same way) ([#1938](https://github.com/quiltdata/quilt/pull/1938))
* [Fixed] Incomplete package stats for empty packages in es/indexer Lambda ([#1869](https://github.com/quiltdata/quilt/pull/1869))
* [Fixed] Slow parquet preview rendering (and probably other occurrences of JsonDisplay) ([#1878](https://github.com/quiltdata/quilt/pull/1878))

## 3.2.1 - 2020-10-14

### Python API

* [Performance] 2X to 5X faster multi-threaded hashing of S3 objects ([#1816](https://github.com/quiltdata/quilt/issues/1816), [#1788](https://github.com/quiltdata/quilt/issues/1788))
* [Fixed] Bump minimum required version of tqdm. Fixes a crash (`UnseekableStreamError`) during upload retry. ([#1853](https://github.com/quiltdata/quilt/issues/1853))

### CLI

* [Added] `--meta` argument to `push` ([#1793](https://github.com/quiltdata/quilt/issues/1793))
* [Fixed] Crash in `list-packages` ([#1852](https://github.com/quiltdata/quilt/issues/1852))

### Catalog, Lambdas

* [Added] Ability to preview larger Jupyter notebooks; warning when cells are elided ([#1823](https://github.com/quiltdata/quilt/issues/1823), [#1822](https://github.com/quiltdata/quilt/issues/1822))
* [Added] Object size to package browsing experience in catalog ([#1744](https://github.com/quiltdata/quilt/issues/1744))
* [Added] Total number of packages to catalog Overview tab ([#1808](https://github.com/quiltdata/quilt/issues/1808))
* [Added] PDF and other file formats, including .gz ones, to catalog Overview tab
* [Added] Drag-n-drop package creation ([#1786](https://github.com/quiltdata/quilt/pull/1786))
* [Added] Glacier support ([#1794](https://github.com/quiltdata/quilt/pull/1794), [#1796](https://github.com/quiltdata/quilt/pull/1796))
* [Added] Show package metadata ([#1806](https://github.com/quiltdata/quilt/pull/1806))
* [Added] Search facets help ([#1828](https://github.com/quiltdata/quilt/pull/1828/))
* [Added] Admin/buckets: re-index and repair ([#1824](https://github.com/quiltdata/quilt/pull/1824))
* [Changed] Case-insensitive package filtering ([#1807](https://github.com/quiltdata/quilt/pull/1807))
* [Changed] Show PDFs in bucket overviews ([#1811](https://github.com/quiltdata/quilt/pull/1811))
* [Changed] Admin/buckets: adjust SNS ARN input, make it possible to not subscribe to a topic ([#1824](https://github.com/quiltdata/quilt/pull/1824))
* [Changed] Show "push package" button when there's no packages in a bucket ([#1843](https://github.com/quiltdata/quilt/pull/1843))
* [Fixed] Bugs involving bad or missing package stats during S3 Select calls ([#1829](https://github.com/quiltdata/quilt/issues/1829))
* [Fixed] Overly aggressive 40X retry logic in es/indexer ([#1804](https://github.com/quiltdata/quilt/issues/1804))
* [Fixed] Semantic bugs in ElasticSearch timeouts (queries now time out properly) ([#1803](https://github.com/quiltdata/quilt/issues/1803))
* [Fixed] Missing Helvetica issues for PDFs ([#1792](https://github.com/quiltdata/quilt/issues/1792))
* [Fixed] Bulletproof file downloads via HTTP header override ([#1787](https://github.com/quiltdata/quilt/pull/1787))
* [Fixed] Previews not rendering in global search ([#1787](https://github.com/quiltdata/quilt/pull/1787))

## 3.2.0 - 2020-09-08 - Package Registry Refactor

### Python

* Refactors local and s3 storage-layer code around a new PackageRegistry base class (to support improved file layouts in future releases)
* Multi-threaded download for large files, 2X to 5X performance gains when installing packages with large files, especially on larger EC2 instances
* Package name added to Package.resolve_hash
* Bugfix: remove package revision by shorthash
* Performance improvements for build and push

### Catalog & Lambdas

* PDF previews
* Browse full package contents (no longer limited to 1000 files)
* Indexing and search package-level metadata
* Fixed issue with download button for certain text files
* FCS files: content indexing and preview
* Catalog sign-in with email (or username)
* Catalog support for sign-in with Okta

## 3.1.14 - 2020-06-13 - Python API features, fixes, catalog capabilities, backend optimizations

### Catalog

* .cef preview
* allow hiding download button
* only show stats for 2-level extensions for .gz files

### Python

* `quilt3.logged_in()`
* fix retries during hashing
* improve progress bars
* fix `quilt3 catalog`
* expanded documentation
* reduce `pyyaml` requirements to prevent version conflicts

### Backend

* improve unit test coverage for indexing lambdas
* fix real-time delete handling (incl. for unversioned objects)
* handle all s3:ObjectCreated: and ObjectRemoved: events (fixes ES search state and bucket Overview)

## 3.1.13 - 2020-04-15 - Windows Support

### Python API

* Official support for Windows
* Add support for Python 3.7, 3.8
* Fix Package import in Python
* Updated libraries for stability and security
* Quiet TQDM for log files ($ export QUILT_MINIMIZE_STDOUT=true )
* CLI setting of config parameters

### Catalog

* new feature to filter large S3 directories with regex
* more reliable bucket region inference
* Support preview of larger Jupyter notebooks in S3 (via transparent GZIP)
* JS (catalog) dependencies for stability and security
* extended Parquet file support (for files without a .parquet extension)
* Improvements to catalog signing logic for external and in-stack buckets

Special thanks to @NathanDeMaria (CLI and Windows support) and @JacksonMaxfield for contributing code to this release.

## 3.1.12 - 2020-03-11 - Command line push

Python

* Add `push` to CLI

## 3.1.11 - 2020-03-10 - New command line features, bug fixes

Catalog

* Updated JS dependencies
* Display package truncation warning in Packages

Python

* `quilt3 install foo/bar/subdirectory`
* Bug fixes for CopyObject and other exceptions

## 3.1.10 - 2020-01-29

### Python Client

* Fix bug introduced in 3.1.9 where uploads fail due to incorrect error checking after a HEAD request to see if an object already exists (#1512)

## 3.1.9 - 2020-01-29

### Python Client

* `quilt3 install` now displays the tophash of the installed package (#1461)
* Added `quilt3 --version` (#1495)
* Added `quilt3 disable-telemetry` CLI command (#1496)
* CLI command to launch catalog directly to file viewer - `quilt3 catalog $S3_URL` (#1470, #1487)
* No longer run local container for `quilt3 catalog` (#1504). See (#1468, #1483, #1482) for various bugs leading to this decision.
* Add PhysicalKey class to abstract away local files vs unversioned s3 object vs versioned s3 object (#1456, #1473, #1478)
* Changed cache directory location (#1466)
* More informative progress bars (#1506)
* Improve support for downloading from public buckets (#1503)
* Always disable telemetry during tests (#1494)
* Bug fix: prevent misleading CLI argument abbreviations (#1481) such as `--to` referring to `--tophash`
* Bug fix: background upload/download threads are now killed if the main thread is interrupted (#1486)
* Performance improvements: load JSONL manifest faster (#1480)
* Performance improvement: If there is an error when copying files, fail quickly (#1488)

### Catalog

* Better package listing UX (#1462)
* Improve bucket stats visualization when there are many categories (#1469)

## 3.1.8 - 2019-12-20 - Catalog Command Fixes and Performance Improvements

### Python API

* Bug-fixes for `quilt3.config` and `quilt3.catalog`
* Performance improvements for Packages

### Catalog

* Updated landing page

## 3.1.7 - 2019-12-13 - Package Cache

### Catalog

* New `LOCAL` mode for running the catalog on localhost

### Python API

* `quilt3 catalog` command to run the Quilt catalog on your local machine
* `quilt3 verify` compares the state of a directory to the contents of a package version
* Added a local file cache for installed packages
* Performance improvements for upload and download
* Support for short hashes to identify package versions
* Adding telemetry for API calls

## 3.1.6 - 2019-12-03 - Package rollback

### API Improvements

* Implement Package.rollback
* Drop support for object metadata (outside of packages)
* Change the number of threads used when installing and pushing from 4 to 10 (S3 default)
* Misc bug fixes

## 3.1.5 - 2019-11-20 - Catalog and API improvements

### Catalog

* Fix package listing for packages with more 100 revisions
* Add stacked area charts for downloads
* 2-level file-extensions for bucket summary

### Python

* Fix uploads of very large files
* Remove unnecessary copying during push

## 3.1.4 - 2019-10-17

* [`delete_package`](https://docs.quilt.bio/api-reference/api#delete\_package) for a specific version via `top_hash=`

## 3.1.3 - 2019-10-11

* Bug fix: when adding python objects to a package a temporary file would be created and then deleted when the object was pushed, leading to a crash if you tried to push that package again (PR #1264)

## 3.1.2 - 2019-10-11

* Added support for adding an in-memory object (such as a `pandas.DataFrame`) to a package via `package.set()`
* Fix to work with pyarrow 0.15.0
* Performance improvements for list_packages and delete_package
* Added `list_package_versions` function

## 3.0.0 - 2019-05-24 - Quilt 3 (formerly Quilt T4) Initial Release

This is the initial release of the new and improved Quilt 3 ([formerly Quilt T4](https://github.com/quiltdata/t4)). For more information [refer to the documentation](https://docs.quilt.bio/).

## 2.9.15 - 2019-01-09 - Teams Config

### Compiler

Adds a feature to allow `quilt config` to set a registry URL for a private Teams registry.

## 2.9.14 - 2018-12-20 - Push Package by Hash

### Compiler

* Adding a hash argument to `quilt.push` to allow pushing any package version to a registry.

### Registry

* Make object sizes required.
* Update urllib3 version for security patch

### Docs

* Improved instructions for running registries.

## 2.9.13 - 2018-11-12 - Fix ascii decoding bug

* Fix an ascii decoding issue related to ellipses …

## 2.9.12 - 2018-10-11 - Pyarrow 0.11 compatibility

### Make Quilt work with pyarrow 0.11

* Update Parquet reading code to match the API change in pyarrow 0.11.
* Fix downloading of zero-byte files

## 2.9.11 - 2018-09-11 - Save Objects to Existing Packages

### Compiler

* New helper function `quilt.save` adds an object (e.g., a Pandas DataFrame) to an existing package by performing a sub-package build and push in a single step
* BugFix: `quilt.load` now correctly returns sub-packages (fixes issue #741)

### Registry

* Send a welcome email to new users after activation

## 2.9.10 - 2018-08-08 - Minor updates and improved documentation

### Compiler

* fixes an issue with packages created on older versions of pyarrow
* improves readability for `quilt inspect`
* allow adding a node with metadata using sub-package build/push

### Registry

* adds documentation for running a private registry in AWS

## 2.9.9 - 2018-07-31 - Bug fixes

* Suppress numpy warnings under Python 2.7
* Fix subpackage build and push

## 2.9.8 - 2018-07-30 - Flask-internal Authentication

### Compiler

* Added support for sub-package build and push to allow updates to allow adding nodes to large packages without materializing the whole package
* First-class support for `ndarray`

### Registry

* Replaced dependence on external OAuth2 provider with a built-in authentication and session management
* Registry support for sub-package push

### Catalog

* Updated to support new registry authentication

## 2.9.7 - 2018-07-11 - Asa extensions

### Compiler

* added Bracket accessor for GroupNodes
* asa.plot to show images in packages
* asa.torch to convert packages to PyTorch Datasets
* Enforce fragment store as read-only

### Catalog

* Added source maps and CI for catalog testing

## 2.9.6 - 2018-06-13 - Documentation and Bugfixes

### Documentation

Expands and improves documentation for working with Quilt packages.

### Bug fixes and small improvements

* Load packages by hash
* Choose a custom loader for DataNodes with asa=

### Registry

* Specify Ubuntu version in Dockerfiles

## 2.9.5 - 2018-05-23 - Package Filtering

### Catalog

* display package traffic stats in catalog

### Compiler

* filter packages based on per-node metadata
* get/set metadata for package nodes
* support custom loaders in the _data method

### Registry

* package commenting

## 2.9.4 - 2018-04-20 - Metadata only package install

### Compiler

* Metadata-only package install
* Build DataFrames from existing Parquet files
* Remove HDF5 dependencies
* Code cleanup and refactoring

### Registry

* Option for metadata-only package installs
* New endpoint for fetching missing fragments (e.g., from partially installed packages)
* Improved full-text search

## 2.9.3 - 2018-03-20 - Package Composition

### Compiler

* Allow building packages out of other packages and elements from other packages. A new build-file keyword, `package` inserts a package (or sub-package) as an element in the package being built.

### Catalog

* Upgrade router and other dependencies
* Display packages by author

## 2.9.2 - 2018-03-01 - Quilt Teams

### Catalog Changes to support private registries

* Amin UI for controlling users and access
* Auditing views

### Globbing for package builds

* Allow specifying sets of input files in build.yml

### Command-line support for private registries

* Specify teams packages
* Admin commands to create and activate/deactivate users

## 2.9.1 - 2018-02-06 - Better Progress Bar

Version 2.9.1 introduces a better progress bar for installing (downloading) Quilt packages. Quilt push now sends objects' uncompressed size to the registry. The progress bar is now based on the total bytes downloaded instead of the number of files.

## 2.9.0 - 2018-02-02 - Shared Local Package Storage

### Shared Local Package Storage

Import packages from shared local directories to save storage overhead and network traffic when sharing packages on the same local network.

### Registry Install Stats

Log package installs in the registry to display stats on package use.

### New Python API commands

* generate
* rm
* search

### Drop support for Python 3.4

### (BETA) Team Registries

Updates to commands and local storage to allow users to connect to different registries to support teams running private registries for internal sharing.

## 2.8.4 - 2018-01-24 - Fix download retry

Fixes a bug in download that prevented retrying failed downloads.

## 2.8.3 - 2018-01-19 - Remove Unneeded Pandas dependency

&#35;186 introduced an undeclared dependency on Pandas >= 0.21.0 (by catching ParserError during CSV parsing). This release removes that dependency and resolves #291.

## 2.8.2 - 2018-01-17 - Hotfix for several quilt commands

PR <https://github.com/quiltdata/quilt/pull/290>

## 2.8.1 - 2018-01-10 - Add Quilt Catalog

### Quilt Catalog

Source for the Quilt data catalog is now included in this repository.

### MySQL->Postgres

Ported the Quilt registry from MySQL to Postgres

### Docker Compose

Improvements to the docker configuration that allows running the registry, catalog, database and authentication service from Docker compose.

### Parallel Download

Data fragments can now be downloaded in parallel leading to much faster package installs for large packages.

## 2.8.0 - 2017-12-07 - Centralized Local Package Store

## Release Highlights

### Quilt packages live in a centralized location on your machine

<!-- markdownlint-disable-next-line descriptive-link-text -->
Quilt data packages are now available wherever you run Python. We recommend that users **quilt push all local packages to the registry before upgrading**. Further details on migration are [here](https://docs.quilt.bio/troubleshooting.html).

### Faster builds with build cache

Quilt now caches build intermediates. So if you wish to update the README of a multi-gigabyte package, you can rebuild the entire package in one second.

### Group-level build parameters

<!-- markdownlint-disable-next-line descriptive-link-text -->
You can now specify build parameters (like transform) for all children of a group in one shot. The updated syntax and docs are [here](https://docs.quilt.bio/buildyml.html).

### quilt.yml is like requirements.txt but for data

<!-- markdownlint-disable-next-line descriptive-link-text -->
You can now express dependencies on multiple packages in a single file. Docs [here](https://docs.quilt.bio/cli.html#installing-via-requirements-file).

### Experimental: build a package from a GitHub repo

Quilt build now accepts GitHub URLs. If you use data stored on GitHub you can turn it into a Quilt package with quilt build.

## 2.7.1 - 2017-11-09 - Checks: unit tests for data packages

Version 2.7.1 includes several minor bug fixes and one new feature, checks. Checks allow a user to specify data integrity checks that are enforced during quilt build.

## 2.7.0 - 2017-08-18 - Subpackages and more efficient uploads/downloads

* Support installing subpackages as `quilt install usr/pkg/path`
* Upload fragments in parallel
* Use http sessions when accessing S3

## 2.6.3 - 2017-07-22 - Clear session to prevent quilt.login() bugs in Jupyter

## 2.6.1 - 2017-07-20 - Package Delete

This release adds a new command to delete a package including all versions and history from the registry.

## 2.6.0 - 2017-07-14 - Fast Builds for Large Packages

Building a package from a directory of input files now skips generating a build file. That speeds up the build process and makes it easier to change the package contents and rebuild.

## 2.5.1 - 2017-07-06 - Push Public Packages

This release includes support for paid plans on quiltdata.com and is recommended for all individual and business-plan users. It adds a shortcut to push packages and make them public in a single command and improves documentation.
