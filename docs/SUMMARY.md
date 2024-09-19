# Quilt Documentation

* [Introduction](README.md)
* [Mental Model](MentalModel.md)
* [Architecture](Architecture.md)  

## Quilt Platform Usage (Catalog UI)

* [About the Catalog](walkthrough/working-with-the-catalog.md)  
* [Browsing Files](Catalog/FileBrowser.md)  
* [Embeddings](Catalog/Embed.md)  
* [Metadata for Teams](Catalog/Metadata.md)  
* [Preview](Catalog/Preview.md)  
* [Search & Query](Catalog/SearchQuery.md)  
* [Visualization & Dashboards](Catalog/VisualizationDashboards.md)

## Quilt Platform Administration

* [Admin UI](Catalog/Admin.md)  
* [Configuration](Catalog/Preferences.md)
* [Enterprise Install](technical-reference.md)
* [quilt3.admin API Access](api-reference/Admin.md)
* [Workflows](advanced-features/workflows.md)
* **Configuration**  
  * [Cross-Account Access](CrossAccount.md)  
  * [Package Events](advanced-features/package-events.md)  
  * [Private Endpoints](advanced-features/private-endpoint-access.md)  
  * [Restrict Access to Bucket Prefixes](advanced-features/s3-prefix-permissions.md)  
  * [S3 Events, EventBridge](EventBridge.md)  
  * [SSO Permissions Mapping](advanced-features/sso-permissions.md)
* **Best Practices**  
  * [S3 Buckets Organization](advanced-features/s3-bucket-organization.md)  
  * [GxP & Quilt Security & Compliance](advanced-features/good-practice.md)

## Ecosystem Integrations

* [Nextflow Plugin](examples/nextflow.md)  
* [Event-Driven Packaging](advanced-features/event-driven-packaging.md)
* [Benchling Packager](https://open.quiltdata.com/b/quilt-example/packages/examples/benchling-packager)

## Quilt Python SDK

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
  * [Local Development Mode](Catalog/LocalMode.md)  
  * [CLI, Environment](api-reference/cli)  
  * [Known Limitations](api-reference/limitations)
  * [Custom SSL Certificates](api-reference/custom-ssl-certificates)
* **Advanced**  
  * [Athena](advanced-features/athena.md)
  * [Buckets](walkthrough/working-with-a-bucket.md)  
  * [Elasticsearch](walkthrough/working-with-elasticsearch.md)  
  * [Filtering a Package](advanced-features/filtering-a-package.md)  
  * [.quiltignore](advanced-features/.quiltignore.md)  
  * [Materialization](advanced-features/materialization.md)
  * [Working with Manifests](advanced-features/working-with-manifests.md)  
  * [S3 Select](advanced-features/s3-select.md)  
  * [Troubleshooting](Troubleshooting.md)
* **More**  
  * [Frequently Asked Questions](FAQ.md)  
  * [Contributing](CONTRIBUTING.md)  
  * [Changelog](CHANGELOG.md)
