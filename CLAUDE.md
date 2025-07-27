<!-- markdownlint-disable MD013 -->
# CLAUDE.md: quiltdata/quilt

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Quilt is a data lakehouse platform consisting of three main components:

1. **Quilt Platform/Catalog** (`/catalog`) - React/TypeScript web application for data visualization, search, and browsing
2. **Quilt Python SDK** (`/api/python`) - Python library for programmatic data package management  
3. **AWS Lambda Functions** (`/lambdas`) - Serverless processing for indexing, previews, thumbnails, etc.

The catalog is a React application using Material-UI, Redux/Redux-Saga for state management, and GraphQL/URQL for API communication. Lambda functions handle backend processing like document indexing, file previews, and thumbnail generation.

## Common Development Commands

### Catalog (Web Application)

```bash
cd catalog
npm install                    # Install dependencies
npm start                      # Start development server
npm run build                  # Production build
npm test                       # Run tests
npm run lint                   # Lint JavaScript/TypeScript
npm run lint:app               # Lint app code specifically
npm run gql:generate           # Generate GraphQL types
```

### Python SDK

```bash
cd api/python
pip install -e .[tests]       # Install for development
pytest --disable-warnings     # Run tests
make test                      # Alternative test command
make install-local            # Install locally for development
```

### Lambda Functions

Each lambda has its own directory under `/lambdas/` with individual requirements.txt and test suites. Use `lambdas/run_lambda.py` for local testing.

## Key Directories and Patterns

- `/catalog/app/` - Main React application code
- `/catalog/app/components/` - Reusable UI components
- `/catalog/app/containers/` - Page-level containers with business logic
- `/catalog/app/utils/` - Shared utilities and helpers
- `/api/python/quilt3/` - Core Python SDK implementation
- `/lambdas/` - AWS Lambda functions for backend processing
- `/docs/` - Documentation and user guides
- `/shared/` - Shared schemas and GraphQL definitions

## GraphQL and TypeScript

The catalog uses GraphQL with code generation. After modifying `.graphql` files, run `npm run gql:generate` to update TypeScript types. GraphQL schema is shared in `/shared/graphql/schema.graphql`.

## Testing Patterns

- Catalog: Jest with React Testing Library
- Python: pytest with coverage
- Each component typically has `.spec.tsx` or `.test.py` files alongside source

## State Management

The catalog uses Redux with Redux-Saga for side effects. State is organized by feature domains in `/catalog/app/containers/` with actions, reducers, and sagas co-located.

## Build and Deployment

The catalog builds to static assets via Webpack. Lambda functions are packaged as ZIP files or Docker containers. Build scripts are in `/catalog/internals/scripts/` and `/lambdas/scripts/`.
