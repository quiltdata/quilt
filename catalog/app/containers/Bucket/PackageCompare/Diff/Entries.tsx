import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'
import Code from 'components/Code'
import * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { readableBytes, trimCenter } from 'utils/string'
import * as s3paths from 'utils/s3paths'

import type { RevisionResult } from '../useRevision'

interface PhysicalKeyProps {
  className?: string
  url: string
}

function PhysicalKey({ className, url }: PhysicalKeyProps) {
  const { urls } = NamedRoutes.use()
  const to = React.useMemo(() => {
    const { bucket, key, version } = s3paths.parseS3Url(url)
    return urls.bucketFile(bucket, key, version)
  }, [url, urls])
  return (
    <StyledLink className={className} to={to}>
      {url}
    </StyledLink>
  )
}

const useStyles = M.makeStyles((t) => ({
  table: {},
  entryRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: t.spacing(1),
  },
  entryCell: {
    padding: t.spacing(1),
    border: `1px solid ${t.palette.divider}`,
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  added: {
    backgroundColor: t.palette.success.light,
  },
  removed: {
    backgroundColor: t.palette.error.light,
  },
  modified: {
    backgroundColor: t.palette.warning.light,
  },
}))

interface EntriesRowProps {
  logicalKey: string
  left?: Model.PackageEntry
  right?: Model.PackageEntry
}

function EntriesRow({ logicalKey, left, right }: EntriesRowProps) {
  const classes = useStyles()

  const isAdded = !left && right
  const isRemoved = left && !right
  const isModified =
    left &&
    right &&
    (left.physicalKey !== right.physicalKey ||
      left.hash.value !== right.hash.value ||
      left.size !== right.size ||
      JSON.stringify(left.meta) !== JSON.stringify(right.meta))

  if (!isModified)
    return (
      <div className={classes.entryCell}>
        <M.Typography variant="subtitle2">{logicalKey}</M.Typography>
      </div>
    )

  return (
    <div className={classes.entryRow}>
      <div className={cx(classes.entryCell, isRemoved && classes.removed)}>
        <M.Typography variant="subtitle2">{logicalKey}</M.Typography>
        <PhysicalKey
          className={cx(left.physicalKey !== right.physicalKey && classes.removed)}
          url={left.physicalKey}
        />
        <br />
        <Code className={cx(left.hash.value !== right.hash.value && classes.removed)}>
          {left.hash.value}
        </Code>
        <br />
        <M.Typography
          className={cx(left.size !== right.size && classes.removed)}
          variant="body2"
        >
          {readableBytes(left.size)}
        </M.Typography>
        <JsonDisplay value={left.meta} />
      </div>
      <div className={cx(classes.entryCell, isAdded && classes.added)}>
        <M.Typography variant="subtitle2">{logicalKey}</M.Typography>
        <PhysicalKey
          className={cx(left.physicalKey !== right.physicalKey && classes.added)}
          url={right.physicalKey}
        />
        <br />
        <Code className={cx(left.hash.value !== right.hash.value && classes.added)}>
          {right.hash.value}
        </Code>
        <br />
        <M.Typography
          className={cx(left.size !== right.size && classes.added)}
          variant="body2"
        >
          {readableBytes(right.size)}
        </M.Typography>
        <JsonDisplay value={right.meta} />
      </div>
    </div>
  )
}

interface EntriesDiffProps {
  left: RevisionResult
  right: RevisionResult
}

export default function EntriesDiff({ left: left, right: right }: EntriesDiffProps) {
  const classes = useStyles()

  if (left._tag === 'idle' || right._tag === 'idle') {
    return null
  }

  if (left._tag === 'loading' || right._tag === 'loading') {
    return <Lab.Skeleton width="100%" height={200} />
  }

  if (left._tag === 'error' || right._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  const leftData = left.revision.contentsFlatMap || {}
  const rightData = right.revision.contentsFlatMap || {}

  const logicalKeys = Object.keys({ ...leftData, ...rightData }).sort()

  if (logicalKeys.length === 0) {
    return (
      <M.Typography
        variant="body2"
        color="textSecondary"
        style={{ fontStyle: 'italic', textAlign: 'center', padding: 16 }}
      >
        No entries found
      </M.Typography>
    )
  }

  return (
    <div className={classes.table}>
      <div className={classes.entryRow}>
        <div className={classes.entryCell} style={{ fontWeight: 'bold' }}>
          {trimCenter(left.revision.hash, 12)}
        </div>
        <div className={classes.entryCell} style={{ fontWeight: 'bold' }}>
          {trimCenter(right.revision.hash, 12)}
        </div>
      </div>
      {logicalKeys.map((logicalKey) => (
        <EntriesRow
          key={logicalKey}
          logicalKey={logicalKey}
          left={leftData[logicalKey]}
          right={rightData[logicalKey]}
        />
      ))}
    </div>
  )
}
