import * as React from 'react'
import * as M from '@material-ui/core'

import * as Filters from 'components/Filters'
import * as BucketConfig from 'utils/BucketConfig'

export const L = 'loading'

export function ResultType() {
  return <></>
}

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
  return (
    <Filters.Container defaultExpanded title="Result type">
      <Filters.RadioGroup extents={typeExtents} onChange={onChange} value={value} />
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
        <Filters.Enum extents={extents} onChange={onChange} value={value} />
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
        <Filters.Enum extents={extents} onChange={onChange} value={value} />
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
