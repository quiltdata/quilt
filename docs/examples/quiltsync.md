# QuiltSync

Desktop application for syncing versioned Quilt data packages to your local
machine.

Download: [quilt.bio/quiltsync](https://quilt.bio/quiltsync/)

QuiltSync provides local access to Quilt packages stored in S3. Supported
platforms: Windows 10+, macOS 10.14+ (Intel & Apple Silicon), Linux.

## Features

- Browse and sync packages via graphical interface
- Selective file sync to manage disk space
- Version control for data packages
- Browser-based authentication (no AWS credentials required)

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

Access settings via the gear icon:

![QuiltSync Settings](../imgs/quiltsync-settings.png)

- **Version**: Current version and release notes
- **Lineage and cache files**: Opens `.quilt/` directory with package metadata
- **Logs directory**: Application logs for debugging
- **Reset state**: "RELOAD PAGE" refreshes UI, "RE-LOGIN" clears authentication

### Integration with Benchling

QuiltSync integrates with the [Benchling Webhook](./benchling.md):

- Click "sync" button in Benchling's App Canvas
- Package opens in QuiltSync

## Capabilities

### User Interface

- Browse S3-based packages
- Select files or directories to sync
- View file sizes and directory structure
- Monitor sync progress

### Version Control

Quilt packages include version history:

- Track data changes
- Roll back to previous versions
- Reproducible workflows

### Local Access

- Work offline with synced datasets
- Reduced latency for local operations
- Selective sync to save bandwidth

## System Requirements

- **OS**: Windows 10+, macOS 10.14+, Linux
- **Disk**: Varies by package size
- **Network**: Required for S3 sync and catalog authentication
- **Auth**: Browser-based login (no AWS credentials)
