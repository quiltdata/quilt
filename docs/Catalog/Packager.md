# Quilt Packaging Engine (QPE)

*Last updated: 2025-01-19*

## Overview

The Quilt Packaging Engine (QPE) is a service that automates the process of
creating Quilt packages from data stored in Amazon S3. It serves as a key
component in Quilt's SDMS (Scientific Data Management System) strategy, enabling
automated data ingestion and standardization.

## Use Cases

- Automatic package creation from S3 data uploads
- Integration with genomics workflows and ELN (Electronic Lab Notebook) systems
- Automated packaging of research datasets
- Custom data pipeline integration via API

## Architecture

QPE is implemented as a containerized service running on AWS Fargate, exposed through:

- REST API via API Gateway
- EventBridge event handlers
- AWS Step Functions integration

### Key Components

1. **Core Engine**
   - Built on quilt-rs with OpenAPI bindings
   - Deployed as Docker container in ECR
   - Handles package creation and validation

2. **Event Processing**
   - EventBridge rules for automated triggers
   - InputTransformer support for S3 and Omics events
   - Deduplication logic for redundant events

3. **Admin Interface**
   - GUI-based configuration in Quilt Catalog
   - Event transformer management
   - Performance monitoring and debugging tools

## Configuration

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
