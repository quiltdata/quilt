import * as React from 'react'

import FileRowWrapper from 'components/FileManager/FileRowWrapper'
import type { Entry } from 'components/FileManager/FileRow'
import { L } from 'components/Form/Package/types'

export type TreeEntry = Entry & {
  children?: TreeEntry[]
}

interface FileTreeProps {
  className?: string
  draggable?: boolean
  entries: TreeEntry[]
  initialSelection?: Record<string, boolean>
}

export default function FileTree({
  className,
  draggable = false,
  entries,
  initialSelection = {},
}: FileTreeProps) {
  const [selectedMap, setSelectedMap] =
    React.useState<Record<string, boolean>>(initialSelection)
  const [expandedMap, setExpandedMap] = React.useState<
    Record<string, typeof L | boolean>
  >({})

  const handleSelect = React.useCallback(
    (entry: TreeEntry) => {
      const newSelection = { ...selectedMap, [entry.id]: !selectedMap[entry.id] }
      setSelectedMap(newSelection)
      // onSelect(rows.filter((r) => newSelection[`${r.id}`]));
    },
    [selectedMap],
  )
  const handleExpand = React.useCallback((entry: TreeEntry) => {
    setExpandedMap((x) => ({
      ...x,
      [entry.id]: !x[entry.id],
    }))
    // onSelect(rows.filter((r) => newSelection[`${r.id}`]));
  }, [])
  return (
    <div className={className}>
      {entries.map((entry) => (
        <FileRowWrapper
          draggable={draggable}
          entry={entry}
          expanded={expandedMap[entry.id]}
          hasChildren={!!entry.children}
          key={entry.id}
          onClick={() => handleExpand(entry)}
          onSelect={() => handleSelect(entry)}
          onToggle={() => handleExpand(entry)}
          selected={!!selectedMap[entry.id]}
        >
          {!!entry.children && <FileTree entries={entry.children} />}
        </FileRowWrapper>
      ))}
    </div>
  )
}
