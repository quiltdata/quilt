import * as React from 'react'

import assertNever from 'utils/assertNever'
import { readableBytes } from 'utils/string'

import FromTo from './FromTo'
import SummaryItem from './SummaryItem'
import PhysicalKeyChanged from './PhysicalKeyChanged'
import UserMetadata from './UserMetadata'
import type { EntryChange, WhatsChangedInEntry } from './comparePackageEntries'

interface ContentChangedProps {
  size: [number, number]
}

function ContentChanged({ size }: ContentChangedProps) {
  const changes = React.useMemo(
    () => size.map((s) => readableBytes(s)) as [React.ReactNode, React.ReactNode],
    [size],
  )
  return (
    <>
      {'Content and size changed: '}
      <FromTo changes={changes} />
    </>
  )
}

interface ModifiedEntryProps {
  logicalKey: string
  change: WhatsChangedInEntry
}

function ModifiedEntry({
  change: { hash, meta, physicalKey, size },
  logicalKey,
}: ModifiedEntryProps) {
  return (
    <SummaryItem title={logicalKey}>
      {!!meta.length && <UserMetadata changes={meta} />}
      {!!hash && (size ? <ContentChanged size={size} /> : 'Content changed')}
      {!!physicalKey && (
        <PhysicalKeyChanged physicalKey={physicalKey} ignoreVersionChange={!!hash} />
      )}
    </SummaryItem>
  )
}

interface EntryChangeHandlerProps {
  change: EntryChange
}

export default function EntryChangeHandler({ change }: EntryChangeHandlerProps) {
  switch (change._tag) {
    case 'modified':
      return <ModifiedEntry logicalKey={change.logicalKey} change={change.changed} />
    case 'added':
      return (
        <SummaryItem title={change.logicalKey} color="added">
          Added
        </SummaryItem>
      )
    case 'removed':
      return (
        <SummaryItem title={change.logicalKey} color="removed">
          Removed
        </SummaryItem>
      )
    default:
      assertNever(change)
  }
}
