# Quilt

Quilt manages data like code with packages, repositories, browsing and revision history so that teams can experiment faster in machine learning, biotech, and other data-driven domains.

## Repository Structure

This monorepo contains the complete Quilt platform:

### Core Components

- **`api/`** - Python API server and the `quilt3` PyPI package
  - See [api/python/README.rst](api/python/README.rst) for details
- **`catalog/`** - Web frontend for browsing packages and metadata
  - See [catalog/README.md](catalog/README.md) for development setup
- **`lambdas/`** - AWS Lambda functions for background processing
  - Indexing, previews, thumbnails, and more
- **`s3-proxy/`** - S3 proxy service for secure access

### Shared Resources

- **`shared/`** - Shared GraphQL schemas and JSON schemas
- **`py-shared/`** - Shared Python utilities and code
- **`docs/`** - User-facing documentation
- **`gendocs/`** - Documentation generation tools

### Testing & Development

- **`testdocs/`** - Test documentation and examples
- **`quilt3_local/`** - Local development tools

### Configuration

- **`codecov.yml`** - Code coverage configuration
- **`renovate.json`** - Dependency update automation
- **`ruff.toml`** - Python linting configuration
- **`book.json`** - Documentation book configuration

## Quick Start

### Prerequisites

- Node.js 18+ (for catalog)
- Python 3.10+ (for API)
- AWS credentials (for deployment)

### Development Setup

#### Catalog (Frontend)

```bash
cd catalog
cp config.js.example static-dev/config.js
# Edit static-dev/config.js with your configuration
npm install
npm start
```

Visit `http://localhost:3000` to view the catalog.

#### API (Backend)

```bash
cd api/python
pip install -e .
# Follow API-specific setup instructions
```

### Documentation

Full documentation is available at [docs.quilt.bio](https://docs.quilt.bio)

- [Quickstart Guide](https://docs.quilt.bio/quickstart)
- [API Reference](https://docs.quilt.bio/api)
- [Catalog Configuration](catalog/config-schema.json)

## Deployment

Deployment notes and historical deployment documentation can be found in the [`deployment-notes/`](deployment-notes/) directory.

## Contributing

1. Create a feature branch from `main`
2. Make your changes with tests
3. Run linting: `ruff check .` (Python) or `npm run lint` (TypeScript)
4. Submit a pull request

## License

See [LICENSE](LICENSE) for details.

## Support

- Documentation: https://docs.quilt.bio
- Issues: https://github.com/quiltdata/quilt/issues
- Community: https://quiltdata.slack.com

