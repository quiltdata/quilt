<!-- markdownlint-disable MD013 -->
# CLAUDE.md: quiltdata/quilt

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IDE Integration

1. **Claude Code** - This project is actively developed using [Claude Code](https://claude.ai/code) via the `dev@quiltdata.io` account
2. **Recommended setup** - Run this in the Terminal or in your favorite IDE (currently supports VS Code and Cursor)

## Project Structure

Quilt is organized into several main components, each with its own CLAUDE.md file for detailed guidance:

### Core Platform Components

1. **[Catalog Web Application](/catalog/CLAUDE.md)** (`/catalog/`)
   - React/TypeScript web interface for data visualization and browsing
   - Material-UI, Redux/Redux-Saga, GraphQL/URQL stack
   - **Quick start**: `cd catalog && npm install && npm start`

2. **[Python SDK](/api/python/CLAUDE.md)** (`/api/python/`)
   - Core `quilt3` Python library for package management
   - AWS S3 integration, authentication, CLI interface  
   - **Quick start**: `cd api/python && pip install -e .[tests] && pytest`

3. **[Lambda Functions](/lambdas/CLAUDE.md)** (`/lambdas/`)
   - AWS serverless backend processing (indexing, previews, thumbnails)
   - 12+ individual functions with shared utilities
   - **Quick start**: `cd lambdas/<function> && python ../run_lambda.py`

4. **[Documentation](/docs/CLAUDE.md)** (`/docs/`)
   - User guides, API reference, tutorials
   - Related: `/gendocs` (API doc generation), `/testdocs` (doc validation)
   - **Quick start**: See `/docs/CLAUDE.md` for workflow details

### Shared Resources

- `/shared/` - GraphQL schemas and shared configurations
- `/py-shared/` - Python utilities shared across components  
- Root configuration files (`.gitignore`, `renovate.json`, etc.)

## Development Workflow

1. **Choose your component** - Review the appropriate project-specific CLAUDE.md file
2. **Set up environment** - Follow the setup instructions in that component's guide
3. **Make changes** - Use the patterns and conventions documented for that component
4. **Test thoroughly** - Each component has its own testing approach
5. **Update docs** - Regenerate API docs if needed (`/gendocs/build.py`)

## Cross-Component Integration

- **GraphQL Schema**: Shared in `/shared/graphql/schema.graphql`
- **Python Shared Code**: Located in `/py-shared/` and `/lambdas/shared/`
- **Build Coordination**: Some scripts coordinate across multiple components

For component-specific guidance, always refer to the individual CLAUDE.md files in each project directory.

## Development Best Practices

### Code Quality

1. **Always check and fix linting issues** - Pay attention to diagnostic warnings from the editor and resolve them
2. **For markdown files** - Add `<!-- markdownlint-disable MD013 -->` at the top to disable line-length restrictions
3. **Test after changes** - Ensure no new diagnostic issues are introduced

### Testing and Validation

1. **Run relevant test suites** before considering work complete:
   - Catalog: `npm test`
   - Python SDK: `pytest`
   - Lambda functions: `pytest` in function directory
   - Documentation: `poetry run pytest --codeblocks ../docs` (from testdocs/)

### Git and Commits

1. **Always ask to create a commit** after implementing a signficant change, and (if there are uncommitted changes) before doing something new
2. **When creating commits** (if requested):
   - Use descriptive commit messages
   - Include `🤖 Generated with [Claude Code](https://claude.ai/code)` footer
   - Run tests before committing

### Documentation

1. **Update documentation** when making significant changes:
   - Regenerate API docs if Python SDK changes (`gendocs/build.py`)
   - Update relevant CLAUDE.md files for architectural changes
   - Validate documentation examples remain current
