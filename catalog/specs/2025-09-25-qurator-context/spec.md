# Specification: Enhanced Qurator Context System

## Overview

Enhance the Qurator AI assistant with automatic context file loading and improved context instrumentation to provide better domain awareness and assistance capabilities.

## Current State

The qurator currently uses:
- `DistributedContext` pattern for context aggregation
- Lazy-loaded context providers in specific views (File, Dir, Search)
- XML-formatted context messages
- Tool registration via `Context.tools`

## Proposed Changes

### 1. Automatic Context File Loading

#### Context File Hierarchy Loading

Automatically load and aggregate context files (README.md and AGENTS.md) following the directory hierarchy:

1. **For regular bucket browsing:**
   - Start at current directory
   - Walk up the directory tree to bucket root
   - Load each README.md and AGENTS.md found in the path
   - Aggregate in order: most specific (current dir) → least specific (bucket root)

2. **For package browsing:**
   - Start at current location within package
   - Walk up to package root following package structure
   - Continue from package root to bucket root (package is treated as direct child of bucket)
   - Load README.md and AGENTS.md files at each level

Example hierarchy:
```
bucket/
├── README.md                    # Bucket context
├── AGENTS.md                    # Bucket agent context
├── data/
│   ├── README.md                # Data directory context
│   ├── AGENTS.md                # Data directory agent context
│   └── experiments/
│       ├── README.md            # Experiments context
│       └── AGENTS.md            # Experiments agent context
└── packages/
    └── my-package@v1.2.3/       # Package root
        ├── README.md            # Package context
        ├── AGENTS.md            # Package agent context
        └── analysis/
            ├── README.md        # Analysis within package
            └── AGENTS.md        # Analysis agent context
```

When viewing `bucket/packages/my-package@v1.2.3/analysis/`:
- Load: analysis/README.md, analysis/AGENTS.md → my-package@v1.2.3/README.md, my-package@v1.2.3/AGENTS.md → bucket/README.md, bucket/AGENTS.md
- Apply file limit: Maximum 10 non-root context files, prioritizing closer directories
- Truncate each file to 10KB if necessary

#### Context File Format

README.md and AGENTS.md files can contain anything. Files are:
- Truncated to 10KB (10,000 bytes) if larger
- Limited to 10 non-root files total (root files always included)
- Prioritized by proximity (closer directories first)

#### XML Context Representation

Context files are represented in XML with attributes to identify their source:

```xml
<context-file
  path="/data/README.md"
  truncated="false"
  scope="bucket"
  bucket="my-bucket">
  [README content here]
</context-file>

<context-file
  path="/analysis/README.md"
  truncated="false"
  scope="package"
  bucket="my-bucket"
  package-name="my-package">
  [README content here]
</context-file>
```

Attributes:
- `scope`: Either "bucket" or "package" to indicate the context source
- `bucket`: The bucket name where the file resides
- `package-name`: (For package scope only) The package name

### 2. Enhanced Context Instrumentation

Add context providers for:

- Package metadata (split into system and user metadata)
- Package revision information

#### Package Metadata Split

Package metadata is exposed via two separate XML tags for better semantic separation:

1. **`<package-info>`**: System-level package information
   - bucket, name, hash
   - modified timestamp
   - commit message
   - workflow information
   - totalEntries, totalBytes

2. **`<package-metadata>`**: User-defined metadata
   - Contains only the userMeta field when present
   - Omitted entirely if userMeta is null or undefined

## Key Components to Modify

1. **Core Context System**
   - Extend `Context.tsx` to support file loading
   - Add README.md discovery and loading logic

3. **New Context Providers**
   - Package metadata context provider

### 3. De-emphasize Tool Call Message UI

Reduce visual prominence of tool call messages to keep focus on the conversation flow:

1. **Visual Treatment**
   - Use fainter background color for tool call message boxes
   - Reduce border emphasis while maintaining readability
   - Create less distracting visual hierarchy

2. **Replace Text Labels with Icons**
   - Replace "Tool Use" text label with appropriate icon
   - Use status icons instead of text for progress/success/error states:
     - Progress: spinner or loading animation
     - Success: checkmark icon
     - Error: warning/error icon

3. **Collapse Tool Details by Default**
   - Hide JSON details under collapsible spoiler/accordion
   - Default to collapsed state to reduce visual noise
   - Provide clear expansion affordance for debugging
   - Preserve full details for troubleshooting purposes

## Expected Outcomes

1. Assistant has better awareness of:
   - Current location and available data
   - Domain-specific knowledge from README files
   - Package structure and metadata

2. Users can customize assistant behavior by:
   - Adding README.md files with context
   - Providing domain-specific instructions
   - Documenting common workflows
   - Providing agent-specific instructions via AGENTS.md

3. Improved assistance for:
   - Navigation suggestions
   - Data discovery
   - Package operations

4. Cleaner UI experience:
   - Less visual distraction from tool call messages
   - Focus remains on conversation content
   - Debugging capabilities preserved but de-emphasized
