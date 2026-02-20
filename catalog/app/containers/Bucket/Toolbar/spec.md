# Toolbar Architecture Specification

## Directory Structure

```sh
Bucket/
├── {Dir, File, Package}/
│   └── Toolbar/
│       ├── Add/
│       │   ├── Context.tsx
│       │   └── Options.tsx
│       ├── Get/
│       │   └── Options.tsx
│       ├── Organize/
│       │   ├── Context.tsx
│       │   └── Options.tsx
│       ├── CreatePackage/
│       │   └── Options.tsx
│       └── useFeatures.tsx
└── Toolbar/  # Button components and shared types
    ├── Assist.tsx         # Special component (doesn't follow standard pattern)
    ├── Toolbar.tsx        # All button components (Add, Get, Organize, CreatePackage)
    ├── types.ts           # Shared type definitions (Handle, DirHandle, etc.)
    └── index.ts           # Exports from types.ts and Toolbar.tsx
```

## Module Structure

Each toolbar module consists of:

- **Button**
  - `Toolbar/Toolbar.tsx` exports `<Toolbar.[ModuleName] />`)
  - Shared UI components
- **Context**
  - `{Dir,File}/Toolbar/[ModuleName]/Context.tsx`
  - Business logic (optional)
- **Options**
  - `{Dir,File}/Toolbar/[ModuleName]/Options.tsx`)
  - Menu content with typed feature props
- **useFeatures**
  - `{Dir,File}/Toolbar/useFeatures.tsx`
  - Maps BucketPreferences to feature availability with typed interfaces

## Adding New Components

To add a new toolbar module (e.g., "Share"):

### 1. Create Module Structure

```sh
Bucket/Dir/Toolbar/Share/
├── Context.tsx  # If complex logic needed
└── Options.tsx  # Menu content
```

### 2. Add Shared Button

```typescript
// Add to Bucket/Toolbar/Toolbar.tsx
import * as Icons from '@material-ui/icons'

export function Share({ label = 'Share', ...props }: ButtonProps) {
  return (
    <Buttons.WithPopover
      icon={Icons.ShareOutlined}
      label={label}
      {...props}
    />
  )
}
```

### 3. Implement Context (if needed)

```typescript
// Share/Context.tsx
import invariant from 'invariant'
import * as React from 'react'

interface ShareActions {
  doSome: () => void
}

const Context = React.createContext<ShareActions | null>(null)

export function use(): ShareActions {
  const context = React.useContext(Context)
  invariant(context, 'useShare must be used within Provider')
  return context
}

interface ProviderProps {
  children: React.ReactNode
  handle: Toolbar.DirHandle
}

export function Provider({ children, handle }: ProviderProps) {
  const doSome = React.useCallback(() => {
    // Logic here
  }, [])

  const actions = React.useMemo(
    (): ShareActions => ({
      doSome,
    }),
    [doSome],
  )

  return (
    <Context.Provider value={actions}>
      {children}
    </Context.Provider>
  )
}
```

### 4. Implement Options

```typescript
// Share/Options.tsx
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import { CloseOnClick } from 'components/Buttons'
import * as Context from './Context'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true }

export default function Options() {
  const { doSome } = Context.use()

  return (
    <CloseOnClick>
      <M.List dense>
        <M.ListItem button onClick={doSome}>
          <M.ListItemIcon><Icons.ShareOutlined /></M.ListItemIcon>
          <M.ListItemText
            primary="Share"
            primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
          />
        </M.ListItem>
      </M.List>
    </CloseOnClick>
  )
}
```

**Closing the popover:** Wrap actionable content with
`<CloseOnClick>` — it closes the popover on any click
bubbling through it. For standalone buttons,
call `usePopoverClose()` directly.

### 5. Add to Features Type

```typescript
// In useFeatures.tsx
export interface Features {
  add: boolean
  get: false | { code: boolean }
  organize: false | { delete: boolean }
  createPackage: boolean
  share: boolean // New feature
}

// In useFeatures hook
export function useFeatures(): Features | null {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions, blocks } }) => ({
        // ...existing features
        share: actions.shareObject, // Map to permission
      }),
      _: () => null,
    },
    prefs,
  )
}
```

### 6. Use in Toolbar Component

```typescript
// In Dir/Toolbar/Toolbar.tsx
import * as Share from './Share'

// In render
{features.share && (
  <Share.Context.Provider handle={dirHandle}>
    <Toolbar.Share>
      <Share.Options />
    </Toolbar.Share>
  </Share.Context.Provider>
)}
```

### 7. Add Tests

```typescript
// Add to Bucket/Toolbar/Toolbar.spec.tsx
describe('Share', () => {
  it('should render with default label', () => {
    const { container } = render(<Toolbar.Share>Hello, Popover!</Toolbar.Share>)
    expect(container).toMatchSnapshot()
  })
})
```

## Usage Examples

### Simple Module

```typescript
// Get/Options.tsx - No Context needed
export default function Options({ handle }: OptionsProps) {
  return (
    <div>Hello world!</div>
  )
}

// Usage
<Toolbar.Get>
  <Get.Options handle={handle} />
</Toolbar.Get>
```

### Module with Features

```typescript
// Get/Options.tsx - Receives typed features
interface OptionsProps {
  handle: Toolbar.DirHandle
  features: Exclude<Features['get'], false>
}

export default function Options({ handle, features }: OptionsProps) {
  return (
    <GetOptions
      download={<DownloadButton />}
      code={features.code ? <CodeSamples /> : undefined}
    />
  )
}

// Usage in Toolbar
{features.get && (
  <Toolbar.Get>
    <Get.Options handle={handle} features={features.get} />
  </Toolbar.Get>
)}
```

### Module with Context

```typescript
// Usage
<Organize.Context.Provider onReload={onReload}>
  <Toolbar.Organize>
    <Organize.Options />
  </Toolbar.Organize>
</Organize.Context.Provider>
```
