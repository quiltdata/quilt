/**
 * Context Menu Component
 *
 * Cursor-style @ mention menu with multiple categories:
 * - Buckets
 * - Packages
 * - Files
 * - Recent Searches
 * - Metadata
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import {
  Folder as BucketIcon,
  Archive as PackageIcon,
  InsertDriveFile as FileIcon,
  History as RecentIcon,
} from '@material-ui/icons'

interface ContextItem {
  id: string
  label: string
  description?: string
  category: string
}

interface ContextCategory {
  id: string
  label: string
  icon: React.ReactNode
  items: ContextItem[]
}

interface ContextMenuProps {
  inputRef: React.RefObject<HTMLInputElement>
  value: string
  onChange: (value: string) => void
  buckets: string[]
}

const useStyles = M.makeStyles((t) => ({
  menu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: '400px',
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(107, 79, 207, 0.2)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(48, 31, 116, 0.16)',
    marginBottom: t.spacing(1),
    zIndex: 1000,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: '180px',
    borderRight: '1px solid rgba(210, 202, 244, 0.3)',
    padding: t.spacing(1, 0),
    background: 'rgba(247, 244, 255, 0.6)',
  },
  category: {
    padding: t.spacing(1, 2),
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
    transition: 'background 0.15s ease-in-out',
    borderRadius: '8px',
    margin: '2px 8px',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.08)',
    },
  },
  categorySelected: {
    background: 'rgba(107, 79, 207, 0.15)',
    borderLeft: '3px solid #6b4fcf',
  },
  categoryIcon: {
    fontSize: '18px',
    color: t.palette.text.secondary,
  },
  categoryLabel: {
    ...t.typography.body2,
    flexGrow: 1,
  },
  categoryCount: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    background: t.palette.action.selected,
    padding: '2px 6px',
    borderRadius: '8px',
    fontSize: '11px',
  },
  content: {
    flexGrow: 1,
    overflowY: 'auto',
    padding: t.spacing(1),
  },
  item: {
    padding: t.spacing(1.5, 2),
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1.5),
    borderRadius: '8px',
    margin: '2px 8px',
    transition: 'background 0.15s ease-in-out',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.08)',
    },
  },
  itemSelected: {
    background: 'rgba(107, 79, 207, 0.15)',
  },
  itemIcon: {
    fontSize: '16px',
    color: t.palette.text.secondary,
  },
  itemContent: {
    flexGrow: 1,
    minWidth: 0,
  },
  itemLabel: {
    ...t.typography.body2,
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemDescription: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  header: {
    padding: t.spacing(1, 2),
    ...t.typography.overline,
    color: t.palette.text.secondary,
    borderBottom: `1px solid ${t.palette.divider}`,
  },
}))

export function ContextMenu({ inputRef, value, onChange, buckets }: ContextMenuProps) {
  const classes = useStyles()
  const [showMenu, setShowMenu] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState('buckets')
  const [selectedItemIndex, setSelectedItemIndex] = React.useState(0)
  const [mentionStart, setMentionStart] = React.useState<number | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Build categories
  const categories: ContextCategory[] = React.useMemo(
    () => [
      {
        id: 'buckets',
        label: 'Buckets',
        icon: <BucketIcon className={classes.categoryIcon} />,
        items: buckets.map((name) => ({
          id: name,
          label: name,
          description: getBucketDescription(name),
          category: 'buckets',
        })),
      },
      {
        id: 'packages',
        label: 'Packages',
        icon: <PackageIcon className={classes.categoryIcon} />,
        items: [
          // Placeholder - would be populated from recent packages
          {
            id: 'recent-package-1',
            label: 'username/dataset',
            description: 'Recent package',
            category: 'packages',
          },
        ],
      },
      {
        id: 'files',
        label: 'Files',
        icon: <FileIcon className={classes.categoryIcon} />,
        items: [
          // Placeholder - would be populated from current context
          {
            id: 'current-file',
            label: 'README.md',
            description: 'Current context',
            category: 'files',
          },
        ],
      },
      {
        id: 'recent',
        label: 'Recent',
        icon: <RecentIcon className={classes.categoryIcon} />,
        items: [
          // Placeholder - would be from search history
          {
            id: 'recent-1',
            label: 'Last search: CSV files',
            description: '5 minutes ago',
            category: 'recent',
          },
        ],
      },
    ],
    [buckets, classes],
  )

  const currentCategory = categories.find((c) => c.id === selectedCategory)
  const filteredItems = React.useMemo(() => {
    if (!currentCategory) return []
    if (!searchQuery) return currentCategory.items

    const query = searchQuery.toLowerCase()
    return currentCategory.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    )
  }, [currentCategory, searchQuery])

  // Detect @ symbol
  React.useEffect(() => {
    const cursorPosition = inputRef.current?.selectionStart || 0
    const textBeforeCursor = value.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex >= 0) {
      const afterAt = textBeforeCursor.substring(lastAtIndex + 1)

      // Check if we're still in the mention (no spaces after @)
      if (!afterAt.includes(' ')) {
        setSearchQuery(afterAt)
        setMentionStart(lastAtIndex)
        setShowMenu(true)
        setSelectedItemIndex(0)
        return
      }
    }

    setShowMenu(false)
    setMentionStart(null)
    setSearchQuery('')
  }, [value, inputRef])

  const insertItem = React.useCallback(
    (item: ContextItem) => {
      if (mentionStart === null) return

      const beforeMention = value.substring(0, mentionStart)
      const cursorPosition = inputRef.current?.selectionStart || 0
      const afterCursor = value.substring(cursorPosition)

      const newValue = `${beforeMention}@${item.label}${afterCursor}`
      onChange(newValue)

      setShowMenu(false)
      setMentionStart(null)

      // Set cursor position after the mention
      setTimeout(() => {
        const newPosition = beforeMention.length + item.label.length + 1
        inputRef.current?.setSelectionRange(newPosition, newPosition)
        inputRef.current?.focus()
      }, 0)
    },
    [mentionStart, value, onChange, inputRef],
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!showMenu) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedItemIndex((prev) => Math.min(prev + 1, filteredItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedItemIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'ArrowLeft':
        case 'ArrowRight':
          // Switch categories
          e.preventDefault()
          const currentIndex = categories.findIndex((c) => c.id === selectedCategory)
          const nextIndex =
            e.key === 'ArrowRight'
              ? Math.min(currentIndex + 1, categories.length - 1)
              : Math.max(currentIndex - 1, 0)
          setSelectedCategory(categories[nextIndex].id)
          setSelectedItemIndex(0)
          break
        case 'Enter':
        case 'Tab':
          if (filteredItems[selectedItemIndex]) {
            e.preventDefault()
            insertItem(filteredItems[selectedItemIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowMenu(false)
          break
      }
    },
    [
      showMenu,
      selectedItemIndex,
      selectedCategory,
      filteredItems,
      categories,
      insertItem,
    ],
  )

  // Attach keyboard handler
  React.useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const handler = (e: any) => handleKeyDown(e)
    input.addEventListener('keydown', handler)
    return () => input.removeEventListener('keydown', handler)
  }, [inputRef, handleKeyDown])

  if (!showMenu) return null

  return (
    <div className={classes.menu}>
      <div className={classes.sidebar}>
        {categories.map((category) => (
          <div
            key={category.id}
            className={`${classes.category} ${category.id === selectedCategory ? classes.categorySelected : ''}`}
            onClick={() => {
              setSelectedCategory(category.id)
              setSelectedItemIndex(0)
            }}
          >
            {category.icon}
            <span className={classes.categoryLabel}>{category.label}</span>
            <span className={classes.categoryCount}>{category.items.length}</span>
          </div>
        ))}
      </div>
      <div className={classes.content}>
        <div className={classes.header}>
          {currentCategory?.label || 'Select a category'}
          {searchQuery && ` • "${searchQuery}"`}
        </div>
        {filteredItems.length === 0 ? (
          <M.Typography variant="body2" style={{ padding: 16, color: '#999' }}>
            No results found
          </M.Typography>
        ) : (
          filteredItems.map((item, index) => (
            <div
              key={item.id}
              className={`${classes.item} ${index === selectedItemIndex ? classes.itemSelected : ''}`}
              onClick={() => insertItem(item)}
              onMouseEnter={() => setSelectedItemIndex(index)}
            >
              <span className={classes.itemIcon}>
                {selectedCategory === 'buckets' && '🪣'}
                {selectedCategory === 'packages' && '📦'}
                {selectedCategory === 'files' && '📄'}
                {selectedCategory === 'recent' && '🕐'}
              </span>
              <div className={classes.itemContent}>
                <div className={classes.itemLabel}>@{item.label}</div>
                {item.description && (
                  <div className={classes.itemDescription}>{item.description}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Helper functions
function getBucketDescription(bucketName: string): string {
  const descriptions: Record<string, string> = {
    'quilt-sandbox-bucket': 'Sandbox environment for testing',
    'quilt-sales-raw': 'Raw sales data storage',
    'quilt-sales-staging': 'Staging environment',
    'quilt-demos': 'Demo datasets',
    'cellpainting-gallery': 'Cell painting microscopy data',
    'data-drop-off-bucket': 'Temporary data drop-off',
    'example-pharma-data': 'Example pharmaceutical data',
    'nf-core-gallery': 'Nextflow pipeline gallery',
  }
  return descriptions[bucketName] || `S3 bucket: ${bucketName}`
}
