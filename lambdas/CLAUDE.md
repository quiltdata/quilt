<!-- markdownlint-disable MD013 -->
# CLAUDE.md: quiltdata/quilt/lambdas

This file provides guidance to Claude Code (claude.ai/code) when working with the Quilt Lambda functions.

## Project Overview

The Quilt Lambda functions provide serverless backend processing for the Quilt data lakehouse platform. These AWS Lambda functions handle document indexing, file previews, thumbnail generation, package events, and other data processing tasks triggered by S3 events or API calls.

## Lambda Functions Overview

### Core Processing Functions

- **indexer** - Extracts text content from documents for search indexing
- **preview** - Generates HTML previews for various file formats
- **thumbnail** - Creates image thumbnails for visual files
- **tabular_preview** - Handles previews for tabular data (CSV, Parquet, etc.)

### Package Management Functions  

- **pkgpush** - Handles package pushing and copying operations
- **pkgevents** - Processes package lifecycle events
- **manifest_indexer** - Indexes package manifests for search

### Supporting Functions

- **access_counts** - Tracks file access metrics
- **s3hash** - Computes file checksums for integrity verification
- **es_ingest** - Manages Elasticsearch data ingestion
- **status_reports** - Generates system status reports
- **transcode** - Handles file format conversions

### Shared Components

- **shared** - Common utilities and libraries used across functions

## Development Setup

### Local Testing

```bash
cd lambdas/<function_name>
pip install -r requirements.txt        # Install dependencies
pip install -r test-requirements.txt   # Install test dependencies
pytest                                 # Run tests
```

### Using Local Test Server

```bash
cd lambdas/<function_name>
python ../run_lambda.py               # Start local test server on port 8080
# Then make HTTP requests to http://localhost:8080/lambda
```

## Code Organization Patterns

Each lambda function follows a similar structure:

```tree
<function_name>/
├── index.py                  # Main lambda handler
├── requirements.txt          # Runtime dependencies
├── setup.py                 # Package configuration
├── test-requirements.txt    # Test dependencies
├── tests/                   # Test suite
│   ├── test_<function>.py   # Unit tests
│   └── data/                # Test data files
└── CHANGELOG.md            # Version history
```

## Modern vs Legacy Patterns

### Modern Functions (pyproject.toml)

Some newer functions use modern Python packaging:

- `pyproject.toml` instead of `setup.py`
- `src/` layout with namespaced packages
- `uv.lock` for dependency locking
- Examples: `es_ingest`, `manifest_indexer`, `thumbnail`

### Legacy Functions (setup.py)

Older functions use traditional packaging:

- `setup.py` for configuration
- Direct source in root directory
- `requirements.txt` for dependencies

## Testing Patterns

- **pytest** for all test runners
- Test data stored in `tests/data/` directories
- Mock AWS services and S3 operations
- Integration tests use real file samples
- Test configuration in `pytest.ini` files

## Common Development Tasks

### Adding New Lambda Function

1. Create directory under `/lambdas/`
2. Implement `lambda_handler(event, context)` in `index.py`
3. Add dependencies to `requirements.txt` or `pyproject.toml`
4. Create test suite in `tests/` directory
5. Add build scripts to `scripts/` if needed

### Local Development Workflow

1. Use `run_lambda.py` for local testing
2. Mock S3 events in test data
3. Test with real file samples in `tests/data/`
4. Use pytest for unit and integration tests

### Deployment

- Functions are packaged as ZIP files or Docker containers
- Build scripts in `/lambdas/scripts/`
- Dependencies bundled with function code
- Some functions use ECR for container deployment

## Event Processing Patterns

### S3 Event Processing

Most functions process S3 events with this pattern:

```python
def lambda_handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        # Process file at s3://bucket/key
```

### API Gateway Events

Some functions handle HTTP requests:

```python
def lambda_handler(event, context):
    method = event['httpMethod']
    path = event['path']
    body = event['body']
    # Process HTTP request
```

## Shared Dependencies

### t4_lambda_shared

Common functionality is centralized in the `shared` package:

- `decorator.py` - Function decorators and error handling
- `preview.py` - Common preview generation utilities  
- `utils.py` - Shared helper functions

Functions reference shared code via GitHub URLs in setup.py:

```python
install_requires=[
    "t4_lambda_shared[preview] @ https://github.com/quiltdata/quilt/archive/HASH.zip#subdirectory=lambdas/shared"
]
```

## File Format Support

### Indexer

- Text extraction from PDF, Office docs, notebooks
- Parquet metadata extraction
- Error handling for malformed files

### Preview  

- HTML generation for CSV, JSON, text files
- Notebook rendering with nbconvert
- Parquet data sampling

### Thumbnail

- Image resizing and format conversion
- PDF page extraction
- Scientific image formats (OME-TIFF)

## Error Handling

- Graceful degradation for unsupported formats
- Structured logging for debugging
- Timeout protection for large files
- Memory limits to prevent OOM errors
