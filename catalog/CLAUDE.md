# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Quilt Catalog web application.

## Project Overview

The Quilt Catalog is a React/TypeScript web application that provides a data visualization and browsing interface for the Quilt data lakehouse platform. It allows users to explore S3 buckets, preview files, search data, and manage data packages through a modern web interface.

## Development Setup

```bash
npm install                    # Install dependencies
npm start                      # Start development server (http://localhost:3000)
npm run build                  # Production build
npm test                       # Run test suite
npm run test:watch             # Run tests in watch mode
```

## Code Organization

- `app/` - Main application source code
  - `components/` - Reusable UI components 
  - `containers/` - Page-level containers with Redux integration
  - `utils/` - Shared utilities and helpers
  - `constants/` - Application constants and configuration
  - `embed/` - Embeddable widget components
- `internals/` - Build configuration and tooling
  - `webpack/` - Webpack configuration files
  - `scripts/` - Build and analysis scripts
- `server/` - Express server for production builds

## Architecture Patterns

### State Management
- **Redux** with **Redux-Saga** for side effects
- State organized by feature domains in `containers/`
- Actions, reducers, and sagas co-located with containers
- Immutable state updates using Immutable.js

### GraphQL Integration
- **URQL** client for GraphQL communication
- Generated TypeScript types from GraphQL schema
- Run `npm run gql:generate` after modifying `.graphql` files
- Schema located in `../shared/graphql/schema.graphql`

### Component Structure
- Material-UI for design system components
- Functional components with React Hooks
- TypeScript for type safety
- Test files co-located as `.spec.tsx` or `.test.tsx`

## Key Technologies

- **React 17** with TypeScript
- **Material-UI v4** for UI components
- **Redux + Redux-Saga** for state management
- **URQL** for GraphQL client
- **Webpack 5** for bundling
- **Jest + React Testing Library** for testing

## Testing

- Jest configuration in `jest.config.js`
- Tests use React Testing Library
- Coverage thresholds are intentionally low (legacy codebase)
- Run single test: `npm test -- --testPathPattern=ComponentName`

## Linting and Code Quality

```bash
npm run lint                   # Lint all code
npm run lint:app               # Lint application code only
npm run lint:eslint:fix        # Auto-fix ESLint issues
npm run prettify               # Format code with Prettier
```

## Build and Deployment

- Development server runs on webpack-dev-server
- Production builds output to `build/` directory
- Static assets are served by Express server in production
- Bundle analysis available via `npm run analyze`

## Common Tasks

### Adding New Components
1. Create component in appropriate directory under `app/components/`
2. Include TypeScript types and props interface
3. Add test file with `.spec.tsx` extension
4. Export from `index.ts` file

### Working with GraphQL
1. Add/modify `.graphql` files alongside components
2. Run `npm run gql:generate` to update TypeScript types
3. Import generated hooks in components

### State Management
1. Create actions, reducer, and saga in container directory
2. Connect container to Redux store
3. Use selectors for accessing state
4. Handle side effects in sagas

## Environment Configuration

The application uses different configurations for development and production. Environment-specific settings are handled through webpack DefinePlugin and can be found in the webpack configuration files.