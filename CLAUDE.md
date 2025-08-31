<!-- markdownlint-disable MD013 -->
# Quilt

Data package management and collaboration platform.

## Structure

- `api/python/` - Python client library (quilt3)
- `catalog/` - Web-based data catalog interface
- `lambdas/` - AWS Lambda functions for backend services
- `docs/` - Documentation
- `specs/<subfolder>` - Specifications and design documents (especially for AI coding)

## Development

See component-specific CLAUDE.md files for detailed development instructions.

## important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
ALWAYS fix IDE diagnostics after any edit.

### Markdown Standards

When creating markdown files:

- Always add `<!-- markdownlint-disable MD013 -->` at the top to disable line length checking
- Use `tree` as the language identifier for directory structure code blocks
- ALWAYS fix IDE diagnostics after any edit
