# QuiltSync

**Desktop client for seamless access to versioned, AI-ready datasets.**

Visit [quilt.bio/quiltsync](https://quilt.bio/quiltsync/) to download the latest version.

QuiltSync is a desktop application from Quilt Data that enables scientists, researchers, and engineers to access, manage, and version large datasets locally. Install once and seamlessly sync Quilt data packages (versioned, AI/ML-ready datasets) to your computer across Windows, macOS (Intel & Apple Silicon), and Linux.

## Getting Started

When viewing packages in the Quilt web catalog, you can open them directly in QuiltSync:

1. Navigate to a package in your Quilt catalog
2. Click the "Get Package" button and select "QuiltSync"
3. QuiltSync will open automatically (if installed) and begin syncing the package

### Integration with Benchling

QuiltSync integrates with the [Benchling Webhook](./benchling.md) to provide seamless access to notebook-linked packages:

- In Benchling's App Canvas, click the "sync" button next to any package
- The package or file will open directly in QuiltSync
- Changes and updates are reflected across both platforms

## Overview

QuiltSync brings the power of Quilt data packages to your desktop, providing a local sync solution for cloud-stored data. While datasets may live in remote storage (S3), QuiltSync gives you local access so you can work offline or interact with datasets as if they're on your machine.

## Key Features

### Versioned Data Packages

QuiltSync doesn't just pull files—Quilt packages include version control for data, tracking changes and enabling reproducible workflows. Each package has a complete version history, allowing you to:

- Track data changes over time
- Roll back to previous versions
- Ensure reproducible analysis and ML workflows
- Collaborate with confidence that everyone uses the same data version

### Desktop/Local Access

Even though data lives in cloud storage, QuiltSync provides local sync capabilities:

- Work offline with synced datasets
- Interact with S3 data as if it's on your local machine
- Reduce latency for data-intensive operations
- Control which packages and versions are synced locally

### AI-Ready Format

The platform targets researchers, machine learning engineers, and data science teams who need clean, versioned datasets prepared for AI/ML pipelines:

- Datasets formatted for machine learning workflows
- Metadata and schema validation
- Integration with data science tools and notebooks
- Support for large-scale data operations

## System Requirements

QuiltSync runs on all major operating systems:

- **Operating Systems**: Windows 10+, macOS 10.14+, Linux (modern distributions)
- **Disk Space**: Varies based on package sizes you plan to sync (consider storage for large datasets)
- **Network**: Internet connection required for syncing with S3 (bandwidth considerations for large datasets)
- **AWS Access**: Valid AWS credentials configured for accessing your Quilt buckets
