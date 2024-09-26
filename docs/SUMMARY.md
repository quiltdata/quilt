# Quilt Documentation

* [About Quilt](README.md)
* [Architecture](Architecture.md)
* [Mental Model](MentalModel.md)
* [Metadata Management](Catalog/Metadata.md)
* [Metadata Workflows](advanced-features/workflows.md)

## Quilt Platform Catalog User

* [About the Catalog](walkthrough/working-with-the-catalog.md)
* [Bucket Browsing](Catalog/FileBrowser.md)
* [Document Previews](Catalog/Preview.md)
* [Embeddable iFrames](Catalog/Embed.md)
* [Search & Query](Catalog/SearchQuery.md)
* [Visualization & Dashboards](Catalog/VisualizationDashboards.md)
* **Advanced**
  * [Athena](advanced-features/athena.md)
  * [Elasticsearch](walkthrough/working-with-elasticsearch.md)

## Quilt Platform Administrator

* [Admin Settings UI](Catalog/Admin.md)
* [Catalog Configuration](Catalog/Preferences.md)
* [Cross-Account Access](CrossAccount.md)
* [Enterprise Installs](technical-reference.md)
* [quilt3.admin Python API](api-reference/Admin.md)
* **Advanced**
  * [Package Events](advanced-features/package-events.md)
  * [Private Endpoints](advanced-features/private-endpoint-access.md)
  * [Restrict Access by Bucket Prefix](advanced-features/s3-prefix-permissions.md)
  * [S3 Events via EventBridge](EventBridge.md)
  * [SSO Permissions Mapping](advanced-features/sso-permissions.md)
* **Best Practices**
  * [GxP for Security & Compliance](advanced-features/good-practice.md)
  * [Organizing S3 Buckets](advanced-features/s3-bucket-organization.md)

## Quilt Ecosystem Integrations

* [Benchling Packager](https://open.quiltdata.com/b/quilt-example/packages/examples/benchling-packager)
* [Event-Driven Packaging](advanced-features/event-driven-packaging.md)
* [Nextflow Plugin](examples/nextflow.md)

## Quilt Python SDK Developers

* [Installation](Installation.md)
* [Quick Start](Quickstart.md)
* [Editing a Package](walkthrough/editing-a-package.md)
* [Uploading a Package](walkthrough/uploading-a-package.md)
* [Installing a Package](walkthrough/installing-a-package.md)
* [Getting Data from a Package](walkthrough/getting-data-from-a-package.md)
* [Example: Git-like Operations](examples/GitLike.md)
* **API Reference**
  * [quilt3](api-reference/api.md)
  * [quilt3.Package](api-reference/Package.md)
  * [quilt3.Bucket](api-reference/Bucket.md)
  * [Local Catalog](Catalog/LocalMode.md)
  * [CLI, Environment](api-reference/cli.md)
  * [Known Limitations](api-reference/limitations.md)
  * [Custom SSL Certificates](api-reference/custom-ssl-certificates.md)
* **Advanced**
  * [Browsing Buckets](walkthrough/working-with-a-bucket.md)
  * [Filtering a Package](advanced-features/filtering-a-package.md)
  * [.quiltignore](advanced-features/.quiltignore.md)
  * [Manipulating Manifests](advanced-features/working-with-manifests.md)
  * [Materialization](advanced-features/materialization.md)
  * [S3 Select](advanced-features/s3-select.md)
* **More**
  * [Changelog](CHANGELOG.md)
  * [Contributing](CONTRIBUTING.md)
  * [Frequently Asked Questions](FAQ.md)
  * [Troubleshooting](Troubleshooting.md)
