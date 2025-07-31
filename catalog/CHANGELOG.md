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

- [Added] Search: Table view for package search results (including matching entries) ([#4413](https://github.com/quiltdata/quilt/pull/4413), [#4451](https://github.com/quiltdata/quilt/pull/4451), [#4452](https://github.com/quiltdata/quilt/pull/4452), [#4460](https://github.com/quiltdata/quilt/pull/4460), [#4461](https://github.com/quiltdata/quilt/pull/4461))
- [Changed] Packages tab: Use search view to navigate packages ([#4413](https://github.com/quiltdata/quilt/pull/4413))
- [Fixed] Freeform search: pass 'size' set to 0 to backend, properly handle 'from' ([#4432](https://github.com/quiltdata/quilt/pull/4432))
- [Changed] Increase font size in tooltips and make them uniform ([#4425](https://github.com/quiltdata/quilt/pull/4425))
- [Added] Detect directories and redirect to trailing-slash URLs (e.g., `catalog-host/dir` → `catalog-host/dir/`). ([#4398](https://github.com/quiltdata/quilt/pull/4398))
- [Fixed] Respect `packageRoot` config property when creating text files using Catalog UI ([#4397](https://github.com/quiltdata/quilt/pull/4397))
- [Changed] Qurator: Switch to Claude 3.7 Sonnet ([#4343](https://github.com/quiltdata/quilt/pull/4343))
- [Fixed] Qurator: Ensure tools schemas adhere to draft 2020-12 ([#4343](https://github.com/quiltdata/quilt/pull/4343))
- [Added] Support setting the location where files are uploaded while creating or promoting packages (using `packageRoot` config property) ([#4384](https://github.com/quiltdata/quilt/pull/4384))
- [Changed] Search: Only show package comment and hash when including historical versions, adjust stylings ([#4371](https://github.com/quiltdata/quilt/pull/4371))
- [Changed] Allow forms and popups in iframes when **Permissive HTML Rendering** enabled ([#4366](https://github.com/quiltdata/quilt/pull/4366))
- [Changed] Search: Loose matching, debounce, hide empty previews ([#4367](https://github.com/quiltdata/quilt/pull/4367))
- [Changed] Streamline search results display ([#4362](https://github.com/quiltdata/quilt/pull/4362))
- [Added] Workflow browser ([#4360](https://github.com/quiltdata/quilt/pull/4360))
- [Changed] Facelift the Open landing ([#4361](https://github.com/quiltdata/quilt/pull/4361))
- [Changed] Combine Download buttons and Code sections into a single Download button and popup ([#4353](https://github.com/quiltdata/quilt/pull/4353))
- [Changed] Simplify button name: "Add quilt_summarize" -> "Configure Summary" ([#4337](https://github.com/quiltdata/quilt/pull/4337))
- [Added] Packager Admin GUI ([#4331](https://github.com/quiltdata/quilt/pull/4331))
- [Fixed] Athena: always show `AwsDataCatalog` in Data catalog selection ([#4335](https://github.com/quiltdata/quilt/pull/4335))
- [Changed] Search Results: Don't show package hash in the header ([#4319](https://github.com/quiltdata/quilt/pull/4319))
- [Changed] Default package search to latest revisions only ([#4319](https://github.com/quiltdata/quilt/pull/4319))
- [Changed] Tabulator: Support `continue_on_error` config option ([#4328](https://github.com/quiltdata/quilt/pull/4328))
- [Added] Search: A switch to search only the latest revisions ([#4316](https://github.com/quiltdata/quilt/pull/4316))
- [Changed] Tabulator: Allow uppercase letters in column names ([#4314](https://github.com/quiltdata/quilt/pull/4314))
- [Fixed] Add Markdown preview when creating the Markdown file ([#4293](https://github.com/quiltdata/quilt/pull/4293))
- [Added] Visual editor for the Bucket UI config (`.quilt/catalog/config.yaml`) ([#4261](https://github.com/quiltdata/quilt/pull/4261))
- [Added] Button to add a `quilt_summarize.json` to a package ([#4273](https://github.com/quiltdata/quilt/pull/4273))
- [Added] Admin: Link to bucket UI config from the bucket settings screen ([#4273](https://github.com/quiltdata/quilt/pull/4273))
- [Added] Admin: Tabulator Settings (open query) ([#4255](https://github.com/quiltdata/quilt/pull/4255))
- [Added] Visual editor for `quilt_summarize.json` ([#4254](https://github.com/quiltdata/quilt/pull/4254))
- [Added] Support "html" type in `quilt_summarize.json` ([#4252](https://github.com/quiltdata/quilt/pull/4252))
- [Fixed] Resolve caching issues where changes in `.quilt/{workflows,catalog}` were not applied ([#4245](https://github.com/quiltdata/quilt/pull/4245))
- [Added] A shortcut to enable adding files to a package from the current bucket ([#4245](https://github.com/quiltdata/quilt/pull/4245))
- [Changed] Qurator: propagate error messages from Bedrock ([#4192](https://github.com/quiltdata/quilt/pull/4192))
- [Added] Qurator Developer Tools ([#4192](https://github.com/quiltdata/quilt/pull/4192))
- [Changed] JsonDisplay: handle dates and functions ([#4192](https://github.com/quiltdata/quilt/pull/4192))
- [Fixed] Keep default Intercom launcher closed when closing Package Dialog ([#4244](https://github.com/quiltdata/quilt/pull/4244))
- [Fixed] Handle invalid bucket name in `ui.sourceBuckets` in bucket config ([#4242](https://github.com/quiltdata/quilt/pull/4242))
- [Added] Preview Markdown while editing ([#4153](https://github.com/quiltdata/quilt/pull/4153))
- [Changed] Athena: hide data catalogs user doesn't have access to ([#4239](https://github.com/quiltdata/quilt/pull/4239))
- [Added] Enable MixPanel tracking in Embed mode ([#4237](https://github.com/quiltdata/quilt/pull/4237))
- [Fixed] Fix embed files listing ([#4236](https://github.com/quiltdata/quilt/pull/4236))
- [Changed] Qurator: switch to Claude 3.5 Sonnet **v2** ([#4234](https://github.com/quiltdata/quilt/pull/4234))
- [Changed] Add `catalog` fragment to Quilt+ URIs (and to documentation) ([#4213](https://github.com/quiltdata/quilt/pull/4213))
- [Fixed] Athena: fix minor UI bugs ([#4232](https://github.com/quiltdata/quilt/pull/4232))
- [Fixed] Show Athena query editor when no named queries ([#4230](https://github.com/quiltdata/quilt/pull/4230))
- [Fixed] Fix some doc URLs in catalog ([#4205](https://github.com/quiltdata/quilt/pull/4205))
- [Changed] S3 Select -> GQL API calls for getting access counts ([#4218](https://github.com/quiltdata/quilt/pull/4218))
- [Changed] Athena: improve loading state and errors visuals; fix minor bugs; alphabetize and persist selection in workgroups, catalog names and databases ([#4208](https://github.com/quiltdata/quilt/pull/4208))
- [Changed] Show stack release version in footer ([#4200](https://github.com/quiltdata/quilt/pull/4200))
- [Added] Selective package downloading ([#4173](https://github.com/quiltdata/quilt/pull/4173))
- [Added] Qurator Omni: initial public release ([#4032](https://github.com/quiltdata/quilt/pull/4032), [#4181](https://github.com/quiltdata/quilt/pull/4181))
- [Added] Admin: UI for configuring longitudinal queries (Tabulator) ([#4135](https://github.com/quiltdata/quilt/pull/4135), [#4164](https://github.com/quiltdata/quilt/pull/4164), [#4165](https://github.com/quiltdata/quilt/pull/4165))
- [Changed] Admin: Move bucket settings to a separate page ([#4122](https://github.com/quiltdata/quilt/pull/4122))
- [Changed] Athena: always show catalog name, simplify setting execution context ([#4123](https://github.com/quiltdata/quilt/pull/4123))
- [Added] Support `ui.actions.downloadObject` and `ui.actions.downloadPackage` options for configuring visibility of download buttons under "Bucket" and "Packages" respectively ([#4111](https://github.com/quiltdata/quilt/pull/4111))
- [Added] Bootstrap the change log ([#4112](https://github.com/quiltdata/quilt/pull/4112))
