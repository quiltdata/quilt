# Quilt: A Data Lakehouse for Actionable Data

Quilt connects teams to actionable data by simplifying data discovery, sharing,
and analysis. It’s designed to serve data-driven organizations with powerful
tools for managing data as code, enabling rapid experimentation, and ensuring
data integrity at scale.

---

## How to Get Started

Quilt consists of three main elements:

- [Quilt Platform](#quilt-platform-overview) which is a cloud platform for
  interacting with, visualizing, searching and querying Quilt Packages, which is
  hosted in an organization's AWS Account.
- [Quilt Python SDK](#quilt-python-sdk) which provides the ability to create,
  push, install and delete Quilt Packages.
- [Quilt Ecosystem](#quilt-ecosystem-and-integrations) which provide extension
  of the core Quilt Capabilities to enable typical elements of life sciences
  workflows, such as incorporating orchestration data, and connecting packages
  to Electronic Lab Notebooks.

To dive deeper into the capabilities of Quilt, start with our [Quick Start
Guide](Quickstart.md) or explore the [Installation
Instructions](Installation.md) for setting up your environment.

If you have any questions or need help, join our [Slack
community](https://slack.quiltdata.com/) or submit a support request to
<support@quiltdata.io>.

---

## Navigating the Documentation

The Quilt documentation is structured to guide users through different layers of
the platform, from basic concepts to advanced integrations. Whether you're a
business user, developer, or platform administrator, the docs will help you
quickly find the information you need.

### Quilt Platform Overview

The **Quilt Platform** powers the core features of the Quilt data catalog,
providing tools for browsing, searching, and visualizing data stored in AWS S3.
The platform is ideal for teams needing to collaborate on data, with
capabilities like embeddable previews and metadata collection.

**Core Sections:**

- [Architecture](Architecture.md) - Learn how Quilt is architected.
- [Mental Model](MentalModel.md) - Understand the guiding principles behind Quilt.
- [Metadata Management](Catalog/Metadata.md) - Manage metadata at scale.

For users of the Quilt Platform (often referred to as the Catalog):

- [Bucket Browsing](Catalog/FileBrowser.md) - Navigate through S3 buckets.
- [Document Previews](Catalog/Preview.md) - Visualize documents and datasets
  directly in the web interface.
- [Search & Query](Catalog/SearchQuery.md) - Leverage Quilt’s powerful search
  and querying capabilities.
- [Visualization & Dashboards](Catalog/VisualizationDashboards.md) - Create
  visual dashboards for data insights.

For administrators managing Quilt deployments:

- [Admin Settings UI](Catalog/Admin.md) - Control platform settings and user access.
- [Catalog Configuration](Catalog/Preferences.md) - Set platform preferences.
- [Cross-Account Access](CrossAccount.md) - Manage multi-account access to S3 data.

### Quilt Python SDK

The **Quilt Python SDK** allows users to programmatically manage data packages,
version datasets, and automate data workflows. Whether you're uploading a
package, fetching data, or scripting custom workflows, the SDK provides the
flexibility needed for deeper integrations.

- [Installation](Installation.md) - Get started with the Quilt SDK.
- [Quick Start](Quickstart.md) - Follow a step-by-step guide to building and
  managing data packages.
- [Editing and Uploading Packages](walkthrough/editing-a-package.md) - Learn how
  to version, edit, and share data.
- [API Reference](api-reference/api.md) - Detailed API documentation for developers.

### Quilt Ecosystem and Integrations

The **Quilt Ecosystem** extends the platform with integrations and plugins to
fit your workflow. Whether you're managing scientific data or automating
packaging tasks, Quilt can be tailored to your needs with these tools:

- [Benchling Packager](examples/benchling.md) - Package electronic lab notebooks
  from Benchling.
- [Nextflow Plugin](examples/nextflow.md) - Integrate with Nextflow pipelines
  for bioinformatics.

---

## Who Should Use Quilt?

Quilt is for teams across industries like machine learning, biotech, and
analytics who need to manage large datasets, collaborate seamlessly, and track
the lifecycle of their data. Whether you're a data scientist, engineer, or
administrator, Quilt helps streamline your data management workflows.

## What Can You Do with Quilt?

- **Share**: Easily share versioned data using simple URLs and email invites.
- **Understand**: Enrich data with inline documentation and visualizations for
  better insights.
- **Discover**: Use metadata and search tools to explore data relationships
  across projects.
- **Model**: Version and manage large data sets that don't fit traditional git repositories.
- **Decide**: Empower your team with auditable data for better decision-making.

---
