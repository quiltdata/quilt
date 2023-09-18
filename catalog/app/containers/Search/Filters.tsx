import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Filters from 'components/Filters'
import * as BucketConfig from 'utils/BucketConfig'
import { formatQuantity, trimCenter } from 'utils/string'

export const L = 'loading'

export interface ActiveFacet<V, E = null> {
  extents?: E | typeof L | null
  onChange: (v: V) => void
  onDeactivate?: () => void
  value: V
}

export function Bucket({ extents, value, onChange }: ActiveFacet<string[], string[]>) {
  return (
    <Filters.Container defaultExpanded extenting={extents === L} title="Buckets">
      {extents && extents !== L && (
        <Filters.Enum
          extents={extents}
          onChange={onChange}
          placeholder="Select buckets"
          value={value}
        />
      )}
    </Filters.Container>
  )
}

export function BucketExtented(props: Omit<ActiveFacet<string[], string[]>, 'extents'>) {
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const extents = React.useMemo(
    () => bucketConfigs.map(({ name }) => `s3://${name}`),
    [bucketConfigs],
  )
  return <Bucket {...props} extents={extents} />
}

export function Comment({ value, onChange, onDeactivate }: ActiveFacet<string>) {
  return (
    <Filters.Container defaultExpanded title="Comment" onDeactivate={onDeactivate}>
      <Filters.TextField
        onChange={onChange}
        placeholder="Enter comment message"
        value={value}
      />
    </Filters.Container>
  )
}

const typeExtents = [
  {
    value: 'po', // TODO: rename to 'any'
    title: 'Packages and objects',
  },
  {
    value: 'p',
    title: 'Packages',
  },
  {
    value: 'o',
    title: 'Objects',
  },
]

export function Type({ value, onChange }: ActiveFacet<string>) {
  const val = typeExtents.find((e) => e.value === value) || null
  return (
    <Filters.Container defaultExpanded title="Result type">
      <Filters.Select<{ value: string; title: string }>
        extents={typeExtents}
        getOptionLabel={(option) => option.title}
        onChange={(o) => onChange(o.value)}
        value={val}
      />
    </Filters.Container>
  )
}

export function TotalSize({
  extents,
  onChange,
  onDeactivate,
  value,
}: ActiveFacet<[number, number] | null, [number, number]>) {
  return (
    <Filters.Container defaultExpanded title="Total size" onDeactivate={onDeactivate}>
      {extents && extents !== L && (
        <Filters.NumbersRange
          extents={extents}
          onChange={onChange}
          unit="Kb"
          value={value}
        />
      )}
    </Filters.Container>
  )
}

export function LastModified({
  extents,
  onChange,
  onDeactivate,
  value,
}: ActiveFacet<[Date, Date] | null, [Date, Date]>) {
  return (
    <Filters.Container defaultExpanded title="Last modified" onDeactivate={onDeactivate}>
      {extents && extents !== L && (
        <Filters.DatesRange extents={extents} onChange={onChange} value={value} />
      )}
    </Filters.Container>
  )
}

export function PackageHash({
  extents,
  onChange,
  onDeactivate,
  value,
}: ActiveFacet<string[], string[]>) {
  return (
    <Filters.Container defaultExpanded title="Package hash" onDeactivate={onDeactivate}>
      {extents && extents !== L && (
        <Filters.List
          extents={extents}
          onChange={onChange}
          value={value}
          placeholder="Filter hashes"
        />
      )}
    </Filters.Container>
  )
}

export function TotalEntries({
  extents,
  onChange,
  onDeactivate,
  value,
}: ActiveFacet<[number, number] | null, [number, number]>) {
  return (
    <Filters.Container
      defaultExpanded
      title="Number of entries in package"
      onDeactivate={onDeactivate}
    >
      {extents && extents !== L && (
        <Filters.NumbersRange
          extents={extents}
          onChange={onChange}
          unit="entries"
          value={value}
        />
      )}
    </Filters.Container>
  )
}

export function Key({ value, onDeactivate, onChange }: ActiveFacet<string>) {
  return (
    <Filters.Container defaultExpanded title="Key" onDeactivate={onDeactivate}>
      <Filters.TextField
        onChange={onChange}
        placeholder="Enter key, eg. test/test.md"
        value={value}
      />
    </Filters.Container>
  )
}

export function Ext({ value, onDeactivate, onChange }: ActiveFacet<string>) {
  return (
    <Filters.Container defaultExpanded title="Key" onDeactivate={onDeactivate}>
      <Filters.TextField
        onChange={onChange}
        placeholder="Enter extension, eg. .md"
        value={value}
      />
    </Filters.Container>
  )
}

export function Size({
  extents,
  onChange,
  onDeactivate,
  value,
}: ActiveFacet<[number, number] | null, [number, number]>) {
  return (
    <Filters.Container defaultExpanded title="Size" onDeactivate={onDeactivate}>
      {extents && extents !== L && (
        <Filters.NumbersRange
          extents={extents}
          onChange={onChange}
          unit="Kb"
          value={value}
        />
      )}
    </Filters.Container>
  )
}

export function Etag({
  extents,
  onChange,
  onDeactivate,
  value,
}: ActiveFacet<string[], string[]>) {
  return (
    <Filters.Container defaultExpanded title="ETag" onDeactivate={onDeactivate}>
      {extents && extents !== L && (
        <Filters.List
          extents={extents}
          onChange={onChange}
          value={value}
          placeholder="Filter etags"
        />
      )}
    </Filters.Container>
  )
}

export function DeleteMarker({ value, onChange, onDeactivate }: ActiveFacet<boolean>) {
  return (
    <Filters.Container defaultExpanded title="Delete marker" onDeactivate={onDeactivate}>
      <Filters.Checkbox label="Show deleted" onChange={onChange} value={value} />
    </Filters.Container>
  )
}

const useWorkflowStyles = M.makeStyles((t) => ({
  workflow: {
    display: 'grid',
    gridRowGap: t.spacing(2),
  },
}))

interface WorkflowValue {
  bucket: string | null
  s3Version: string | null
  workflow: string | null
}

interface WorkflowExtents {
  bucket: string[] | typeof L | null
  s3Version: string[] | typeof L | null
  workflow: string[] | typeof L | null
}

export function Workflow({
  extents,
  onChange,
  onDeactivate,
  value,
}: ActiveFacet<WorkflowValue, WorkflowExtents>) {
  const classes = useWorkflowStyles()
  const handleChange = React.useCallback(
    (patch: Partial<Record<keyof WorkflowValue, string | null>>) => {
      onChange({
        ...value,
        ...patch,
      })
    },
    [onChange, value],
  )
  const areExtentsReady =
    extents !== L && extents?.bucket && extents?.s3Version && extents?.workflow
  return (
    <Filters.Container defaultExpanded title="Workflow" onDeactivate={onDeactivate}>
      {areExtentsReady && (
        <div className={classes.workflow}>
          {extents?.bucket && extents?.bucket !== L && (
            <Filters.Select
              extents={extents.bucket}
              onChange={(bucket) => handleChange({ bucket })}
              placeholder="Select bucket"
              label="Bucket"
              value={value.bucket}
            />
          )}
          {extents?.s3Version && extents?.s3Version !== L && (
            <Filters.Select
              extents={extents.s3Version}
              onChange={(s3Version) => handleChange({ s3Version })}
              placeholder="Select workflows.yaml version"
              label="Workflows.yaml S3 version"
              value={value.s3Version}
            />
          )}
          {extents?.workflow && extents?.workflow !== L && (
            <Filters.Select
              extents={extents.workflow}
              onChange={(workflow) => handleChange({ workflow })}
              placeholder="Select workflow"
              label="Workflow"
              value={value.workflow}
            />
          )}
        </div>
      )}
    </Filters.Container>
  )
}

function getAvailableFacetLabel(facet: string) {
  switch (facet) {
    case 'type':
      return 'Result type'
    case 'buckets':
      return 'Buckets'
    case 'total_size':
      return 'Total size'
    case 'comment':
      return 'Comment'
    case 'last_modified':
      return 'Last modified date'
    case 'package_hash':
      return 'Package hash'
    case 'total_entries':
      return 'Total entries'
    case 'key':
      return 'File name'
    case 'ext':
      return 'File extension'
    case 'size':
      return 'Size'
    case 'etag':
      return 'ETag'
    case 'delete_marker':
      return 'Show/hide deleted'
    default:
      throw new Error('Wrong type')
  }
}

interface AvailableFacetsProps {
  facets: string[] | typeof L
  onClick: (facet: string) => void
}

export function AvailableFacets({ facets, onClick }: AvailableFacetsProps) {
  const items = React.useMemo(() => {
    if (!Array.isArray(facets)) return [] as { label: string; type: string }[]
    return facets.map((type) => ({
      label: getAvailableFacetLabel(type) || '',
      type,
      onClick: () => onClick(type),
    }))
  }, [facets, onClick])
  return facets === L ? <Filters.ChipsSkeleton /> : <Filters.Chips items={items} />
}

type SelectedFacet<V, E = null> = Omit<ActiveFacet<V, E>, 'onChange' | 'onDeactivate'>

type SelectedFilter =
  | { path: 'type'; state: SelectedFacet<'po' | 'p' | 'o'> }
  | { path: 'buckets'; state: SelectedFacet<string[], string[]> }
  | {
      path: 'total_size'
      state: SelectedFacet<[number, number] | null, [number, number]>
    }
  | { path: 'comment'; state: SelectedFacet<string> }
  | { path: 'last_modified'; state: SelectedFacet<[Date, Date] | null, [Date, Date]> }
  | { path: 'package_hash'; state: SelectedFacet<string[], string[]> }
  | {
      path: 'total_entries'
      state: SelectedFacet<[number, number] | null, [number, number]>
    }
  | { path: 'key'; state: SelectedFacet<string> }
  | { path: 'ext'; state: SelectedFacet<string> }
  | { path: 'size'; state: SelectedFacet<[number, number] | null, [number, number]> }
  | { path: 'etag'; state: SelectedFacet<string[], string[]> }
  | { path: 'delete_marker'; state: SelectedFacet<boolean> }

interface ActiveItem {
  label: React.ReactNode
  type: string
  onDelete?: () => SelectedFilter
}

function getActiveItems(filter: SelectedFilter): ActiveItem[] {
  switch (filter.path) {
    case 'type':
      return [
        {
          label: (
            <>
              Return type is{' '}
              <b>
                {
                  { po: 'Packages and objects', p: 'Packages', o: 'Objects' }[
                    filter.state.value
                  ]
                }
              </b>
            </>
          ),
          type: filter.path,
        },
      ]
    case 'buckets':
      if (!filter.state.value.length) return []
      return filter.state.value.map((value) => ({
        label: (
          <>
            In <b>{value}</b> bucket
          </>
        ),
        type: filter.path,
        onDelete: () => ({
          ...filter,
          state: {
            ...filter.state,
            value: filter.state.value.filter((v) => v !== value),
          },
        }),
      }))
    case 'total_size':
      if (!filter.state.value) return []
      if (!filter.state.extents || filter.state.extents === L) return []
      return [
        {
          label: (
            <>
              Total size <b>⩾ {formatQuantity(filter.state.value[0])}</b> and{' '}
              <b>⩽ {formatQuantity(filter.state.value[1])}</b>
            </>
          ),
          type: filter.path,
          onDelete: () => {
            if (!filter.state.extents || filter.state.extents === L) {
              throw new Error('This should not happen')
            }
            return {
              ...filter,
              state: {
                ...filter.state,
                value: filter.state.extents,
              },
            }
          },
        },
      ]
    case 'comment':
      if (!filter.state.value) return []
      return [
        {
          label: (
            <>
              Comment is <b>{trimCenter(filter.state.value, 16)}</b>
            </>
          ),
          type: filter.path,
          onDelete: () => ({
            ...filter,
            state: {
              ...filter.state,
              value: '',
            },
          }),
        },
      ]
    case 'last_modified':
      if (!filter.state.value) return []
      if (!filter.state.extents || filter.state.extents === L) return []
      return [
        {
          label: (
            <>
              Last modified date{' '}
              <b>after {dateFns.format(filter.state.value[0], 'yyyy-MM-dd')}</b> and{' '}
              <b>before {dateFns.format(filter.state.value[1], 'yyyy-MM-dd')}</b>
            </>
          ),
          type: filter.path,
          onDelete: () => {
            if (!filter.state.extents || filter.state.extents === L) {
              throw new Error('This should not happen')
            }
            return {
              ...filter,
              state: {
                ...filter.state,
                value: filter.state.extents,
              },
            }
          },
        },
      ]
    default:
      return [] as ActiveItem[]
  }
}

interface ActiveFacetsProps {
  filters: SelectedFilter[] | typeof L
  onDelete: (facet: SelectedFilter) => void
}

export function ActiveFacets({ filters, onDelete }: ActiveFacetsProps) {
  const items = React.useMemo(() => {
    if (!Array.isArray(filters)) return [] as ActiveItem[]
    return filters
      .reduce((memo, filter) => [...memo, ...getActiveItems(filter)], [] as ActiveItem[])
      .map((i) => ({
        ...i,
        onDelete: i.onDelete ? () => i.onDelete && onDelete(i.onDelete()) : undefined,
      }))
  }, [filters, onDelete])
  return filters === L ? <Filters.ChipsSkeleton /> : <Filters.Chips items={items} />
}
