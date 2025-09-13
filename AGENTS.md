# AI Agent Guide for Quilt

## What is Quilt?

Quilt is a collaborative data platform that unifies data and metadata in
reproducible, discoverable packages stored in S3. It provides:

- **Web Catalog**: React frontend for browsing data packages (`./catalog/`)
- **Backend APIs**: Lambda functions and services (`./lambdas/`, `./api/`)
- **Data Infrastructure**: S3 proxy, ElasticSearch integration (`./s3-proxy/`)
- **Python Client**: Local package management (`./api/python/quilt3/`)
- **Documentation**: Architecture and guides (`./docs/`)

## Repository Structure

```tree
catalog/          # React web frontend (main UI)
lambdas/          # AWS Lambda backend services
api/              # API definitions and schemas
s3-proxy/         # S3 access proxy service
py-shared/        # Shared Python utilities
docs/             # Architecture and user documentation
spec/             # Development specifications (I RASP DECO)
```

## Development Workflow

This repository uses **I RASP DECO methodology** for structured development.
See [`spec/WORKFLOW.md`](./spec/WORKFLOW.md) for the complete process:

- **Issue tracking** with GitHub integration
- **Structured specifications** in `spec/{branch-name}/` directories
- **Phase-based implementation** with atomic episodes
- **Quality gates** via `make test` and `make lint`

### For New Features

1. Create GitHub issue
2. Follow `spec/WORKFLOW.md` steps 1-4 (I RASP phase)
3. Implement via steps 5a-5d (DECO phase) using specialized agents
4. Validate integration in step 6

## Key Technologies

- **Frontend**: React, Redux, Material-UI (catalog)
- **Backend**: Python, AWS Lambda, FastAPI
- **Storage**: AWS S3, ElasticSearch, RDS
- **Infrastructure**: CloudFormation, VPC networking

## Essential Commands

- `make test` - Run all tests
- `make lint` - Code quality checks (ruff, markdownlint)
- `npm start` - Local catalog development (in `./catalog/`)
- `gh pr create` - Create pull requests

## Agent Specializations

Use appropriate agents per `spec/WORKFLOW.md`:

- **Frontend work**: React/JS specialists for catalog UI
- **Backend APIs**: Python/AWS specialists for lambdas
- **Infrastructure**: Cloud architects for deployment
- **Documentation**: Technical writers for user guides
- **Project coordination**: Workflow orchestrators

## Quick Navigation

- Architecture overview: [`docs/Architecture.md`](./docs/Architecture.md)
- Catalog setup: [`catalog/README.md`](./catalog/README.md)
- Development process: [`spec/WORKFLOW.md`](./spec/WORKFLOW.md)
- API schemas: [`api/`](./api/)

The `spec/` folder contains structured development specifications following
I RASP DECO methodology - always reference `spec/WORKFLOW.md` for proper
development process when implementing new features.
