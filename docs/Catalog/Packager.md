# Quilt Packaging Service (QPS)

## Overview

The Quilt Packaging Service in the Quilt Platform allows administrators and
developers to automate the process of creating Quilt packages from data stored
in Amazon S3. It serves as a key component in Quilt's SDMS (Scientific Data
Management System) strategy, enabling automated data ingestion and
standardization. It consists of:

1. Admin Settings GUI to enable package creation for:
   1. AWS Health Omics
   2. `ro-crate-manifest.json` sentinel files
   3. Quilt's Event-Driven Packaging (EDP) system
2. An SQS queue that will process package descriptions
3. EventBridge rules for either an S3 URI or a full package description
4. A complete REST API for package creation

In addition to supporting your custom data pipelines, QPS can be used to build
integrations with genomics workflows and ELNs (Electronic Lab Notebooks).

## Features

### Admin Settings

The following options are configurable through the Catalog Admin Settings:

- Built-in QPE event processing (enabled by default)
- EDP event handling (disabled by default)
- Omics Completion events (disabled by default)
- S3 SNS event processing by file suffix (default: 'metadata.json')

### Bucket Configuration

Administrators can configure QPE to process events across multiple buckets:

- Global settings for all stack buckets
- Selective bucket processing via picklist or regex
- Bucket exclusion via blacklist

## Security

QPE operates with the following security considerations:

- Uses default ReadWrite role permissions for stack buckets
- API-level access control
- Event validation and sanitization
