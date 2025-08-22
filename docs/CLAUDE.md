<!-- markdownlint-disable MD013 -->
# CLAUDE.md: quiltdata/quilt/docs

This file provides guidance to Claude Code (claude.ai/code) when working with the Quilt documentation.

## Project Overview

The `/docs` directory contains the comprehensive user documentation for the Quilt data lakehouse platform. This documentation is organized as a GitBook-style structure covering all aspects of Quilt including the catalog web interface, Python SDK, administration, and ecosystem integrations.

## Documentation Structure

The documentation is organized into several main sections:

### Core Documentation (`/docs`)

- **Platform Overview** - Architecture, mental model, and core concepts
- **Catalog User Guides** - Web interface features, browsing, search, visualization
- **Platform Administration** - Admin settings, cross-account access, enterprise configuration  
- **Python SDK Documentation** - Installation, API reference, walkthroughs, advanced features
- **Ecosystem Integrations** - Benchling, Nextflow, and other third-party tools

### Key Files

- `SUMMARY.md` - Navigation structure and table of contents
- `README.md` - Main landing page and overview
- `Architecture.md` - Technical architecture overview
- `MentalModel.md` - Conceptual framework for understanding Quilt

### Directory Organization

```tree
docs/
├── Catalog/           # Web catalog interface documentation
├── api-reference/     # Detailed API documentation
├── walkthrough/       # Step-by-step tutorials
├── advanced-features/ # Advanced use cases and configuration
├── examples/          # Example integrations and workflows
├── imgs/              # Documentation images and screenshots
└── *.md               # Top-level documentation files
```

## Related Documentation Projects

### `/gendocs` - API Documentation Generation

**Purpose**: Generates Python API reference documentation from docstrings

**Key Components**:

- `build.py` - Main script to generate API docs from Python code
- `pydocmd.yml` - Configuration for pydoc-markdown tool
- `gen_cli_api_reference.sh` - Generates CLI documentation
- `gen_walkthrough.sh` - Generates tutorial documentation

**Workflow**:

1. Uses custom fork of pydoc-markdown (`git+https://github.com/quiltdata/pydoc-markdown.git@quilt`)
2. Extracts docstrings from `quilt3` Python package
3. Converts to markdown format for integration with main docs
4. Outputs to `/docs/api-reference/` directory

**Usage**:

```bash
cd gendocs
pip install git+https://github.com/quiltdata/pydoc-markdown.git@quilt
python build.py
```

### `/testdocs` - Documentation Testing

**Purpose**: Validates that code examples in documentation are syntactically correct and executable

**Key Components**:

- `pyproject.toml` - Poetry configuration with testing dependencies
- Uses `pytest_codeblocks` to extract and test code from markdown files
- `clean.sh` - Removes test artifacts after validation

**Workflow**:

1. Scans markdown files for code blocks
2. Extracts Python code examples
3. Validates syntax and executability
4. Ensures documentation examples stay current with API changes

**Usage**:

```bash
cd testdocs
pip install poetry
poetry install
poetry run pytest --codeblocks ../docs
zsh clean.sh
```

## Documentation Workflow

### Writing Documentation

1. **Content Creation** - Write markdown files in appropriate subdirectories
2. **Navigation** - Update `SUMMARY.md` to include new pages
3. **API Documentation** - Run `gendocs/build.py` to regenerate API reference
4. **Testing** - Run `testdocs` validation to ensure code examples work
5. **Images** - Store screenshots and diagrams in `imgs/` directory

### Content Types

- **Tutorials** (`walkthrough/`) - Step-by-step guides with executable examples
- **How-To Guides** (`Catalog/`, `advanced-features/`) - Task-oriented documentation
- **Reference** (`api-reference/`) - Auto-generated from code docstrings
- **Explanation** - Conceptual documentation explaining the "why" behind features

## Style and Conventions

### Markdown Standards

- Use GitBook-compatible markdown syntax
- Include code language specifiers for syntax highlighting
- Use relative links for internal documentation references
- Store images in `imgs/` with descriptive filenames

### Code Examples

- All code examples should be testable via `testdocs`
- Include imports and setup code needed for examples to run
- Use realistic data and scenarios in examples
- Provide both basic and advanced usage patterns

### Cross-References

- Link between related documentation sections
- Reference API documentation from tutorials
- Include links to external resources and integrations

## Maintenance Tasks

### Keeping Documentation Current

1. **API Changes** - Regenerate API docs when Python SDK changes
2. **Feature Updates** - Update screenshots and examples for UI changes
3. **Link Validation** - Ensure internal and external links remain valid
4. **Code Testing** - Run testdocs regularly to catch breaking changes

### Common Updates

- New feature announcements and tutorials
- Updated installation instructions
- New integration examples
- Troubleshooting guides for common issues
- Performance optimization documentation

The documentation serves as the primary resource for users learning and using Quilt, so maintaining accuracy and clarity is essential for user success.
