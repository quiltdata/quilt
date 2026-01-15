# QuiltSync

QuiltSync is a desktop application for syncing versioned Quilt data packages to
your local machine. It provides local access to Quilt packages stored in S3,
with support for Windows 10+, macOS 10.14+ (Intel & Apple Silicon), and Linux.

Download: [quilt.bio/quiltsync](https://quilt.bio/quiltsync/)

## Features

- Browse and sync packages via graphical interface
- Selective file sync to manage disk space
- Version control for data packages
- Browser-based authentication

## Getting Started

### Installation

Download and install QuiltSync from
[quilt.bio/quiltsync](https://quilt.bio/quiltsync/).

### Opening Packages and Files

From the Quilt web catalog:

1. Navigate to a package or file
2. Click "Get Package" or "Get File"
3. Select "Open in QuiltSync"

![Open in QuiltSync](../imgs/quiltsync-open.png)

### Authentication

On first use, QuiltSync prompts for authentication via your web browser:

1. QuiltSync opens your browser to the Quilt Catalog login page
2. Sign in to your catalog
3. Access token is automatically provided to QuiltSync

The token is tied to your catalog session. No AWS credentials required.

### Selective Installation

Select which files to sync:

- Use checkboxes to select files or folders
- Click "SELECT ALL" for entire package
- Review file sizes before installing
- Click "INSTALL" to sync selected files

### Settings and Troubleshooting

Access settings via the gear icon in the lower right:

![QuiltSync Settings](../imgs/quiltsync-settings.png)

- **Version**: Current version and release notes
- **Lineage and cache files**: Opens `.quilt/` directory with package metadata
- **Logs directory**: Application logs for debugging
- **Reset state**: "RELOAD PAGE" refreshes UI, "RE-LOGIN" clears authentication

### Integration with Benchling

QuiltSync integrates with the [Benchling Webhook](./benchling.md) to provide
seamless access to Quilt packages from Benchling notebooks.

![Benchling App Canvas](../imgs/benchling-canvas.png)

When viewing a package in the Benchling App Canvas:

1. Click the "sync" button next to any package or file
2. QuiltSync automatically opens with the selected package
3. Select files to sync locally
4. Work offline with your data

This integration allows scientists to move from notebook entries to local
datasets without leaving their Benchling workflow. For more details, see
[Benchling App Canvas](./benchling.md#benchling-app-canvas).
