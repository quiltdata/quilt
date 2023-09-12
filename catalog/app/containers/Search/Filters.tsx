import * as React from 'react'

import * as Filters from 'components/Filters'

export const L = 'loading'

export function ResultType() {
  return <></>
}

export interface ActiveFacet<V, E = null> {
  extents?: E | typeof L | null
  onChange: (v: V) => void
  value: V
}

interface BucketProps extends ActiveFacet<string[], string[]> {}

export function Bucket({ extents, value, onChange }: BucketProps) {
  return (
    <Filters.Container defaultExpanded extenting={extents === L} title="Buckets">
      {extents && extents !== L && (
        <Filters.Enum
          extents={extents}
          onChange={onChange}
          placeholder="Select multiple values"
          value={value}
        />
      )}
    </Filters.Container>
  )
}

export function Comment({ value, onChange }: ActiveFacet<string>) {
  return (
    <Filters.Container defaultExpanded title="Comment">
      <Filters.TextField
        onChange={onChange}
        placeholder="Select multiple values"
        value={value}
      />
    </Filters.Container>
  )
}
